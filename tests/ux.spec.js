// @ts-check
// Fase 1 del roadmap: avisos (toasts) y estados de carga «imprimiendo».
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
});

async function fillContact(page) {
  const form = page.locator('#contact-form');
  await form.locator('input[name="name"]').fill('Prueba UX');
  await form.locator('input[name="_replyto"]').fill('ux@example.com');
  await form.locator('textarea[name="message"]').fill('Probando avisos.');
  return form;
}

test('mientras se envía, el botón queda en estado «imprimiendo»', async ({ page }) => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  await page.route('https://formspree.io/**', async (route) => {
    await gate; // retenemos la respuesta para ver el estado intermedio
    await route.fulfill({ status: 422, contentType: 'application/json', body: '{"error":"Probá de nuevo"}' });
  });
  await page.goto('/contacto.html');
  const form = await fillContact(page);
  const submit = form.locator('button[type="submit"]');

  await submit.click();
  await expect(submit).toHaveClass(/is-busy/);
  await expect(submit).toHaveAttribute('aria-busy', 'true');
  await expect(submit).toHaveText('Enviando...');
  await expect(submit).toBeDisabled();

  release();
  await expect(submit).not.toHaveClass(/is-busy/);
  await expect(submit).toHaveText('Enviar consulta');
  await expect(submit).toBeEnabled();
});

test('los errores se anuncian con role="alert" y el aviso se puede cerrar', async ({ page }) => {
  await page.route('https://formspree.io/**', (route) =>
    route.fulfill({ status: 422, contentType: 'application/json', body: '{"error":"Email inválido"}' }));
  await page.goto('/contacto.html');
  const form = await fillContact(page);
  await form.locator('button[type="submit"]').click();

  const alert = page.getByRole('alert').filter({ hasText: 'Email inválido' });
  await expect(alert).toBeVisible();
  await alert.getByRole('button', { name: 'Cerrar aviso' }).click();
  await expect(alert).toHaveCount(0);
});

test('Esc cierra el aviso más reciente', async ({ page }) => {
  await page.route('https://formspree.io/**', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"Servidor caído"}' }));
  await page.goto('/contacto.html');
  const form = await fillContact(page);
  await form.locator('button[type="submit"]').click();

  const toast = page.locator('.toast').filter({ hasText: 'Servidor caído' });
  await expect(toast).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(toast).toHaveCount(0);
});
