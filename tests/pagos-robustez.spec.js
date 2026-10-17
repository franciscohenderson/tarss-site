// @ts-check
// Botón «Pagar» ante fallos transitorios y al volver atrás desde el checkout (bfcache).
const { test, expect } = require('@playwright/test');

test.describe('Pagar: robustez del botón', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
  });

  test('si la primera consulta de pagos falla (503), «Pagar» aparece cuando el servicio se recupera', async ({ page }) => {
    let gets = 0;
    await page.route('**/api/payment-link', (route) => {
      if (route.request().method() !== 'GET') return route.abort();
      gets++;
      return gets === 1 ? route.fulfill({ status: 503, json: {} }) : route.fulfill({ json: { enabled: true, mode: 'sandbox' } });
    });
    await page.goto('/servicios.html');
    const pay = page.locator('#ticket-pay');
    await page.locator('#ticket-form input[data-service="landing"]').check({ force: true });
    await expect.poll(() => gets).toBe(1);
    await expect(pay).toBeHidden();
    // cambia el presupuesto: se vuelve a preguntar y ahora sí está habilitado
    await page.locator('#ticket-form input[data-service="seo-local"]').check({ force: true });
    await expect(pay).toBeVisible();
    expect(gets).toBe(2);
  });

  test('un fallo persistente no genera un bucle de consultas', async ({ page }) => {
    let gets = 0;
    await page.route('**/api/payment-link', (route) => { gets++; return route.fulfill({ status: 503, json: {} }); });
    await page.goto('/servicios.html');
    await page.locator('#ticket-form input[data-service="landing"]').check({ force: true });
    await page.waitForTimeout(600);
    expect(gets).toBeLessThanOrEqual(2);
  });

  test('al volver atrás desde el checkout (pageshow persisted), el botón no queda en «Generando link...»', async ({ page }) => {
    await page.route('**/api/payment-link', (route) => (route.request().method() === 'GET'
      ? route.fulfill({ json: { enabled: true, mode: 'sandbox' } })
      : new Promise(() => {}))); // el POST queda colgado: simula el estado ocupado
    await page.goto('/servicios.html');
    await page.locator('#ticket-form input[data-service="landing"]').check({ force: true });
    const pay = page.locator('#ticket-pay');
    await expect(pay).toBeEnabled();
    await pay.click();
    await expect(pay).toHaveText('Generando link...');
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
    await expect(pay).toHaveText('Pagar ahora');
    await expect(pay).toBeEnabled();
  });
});
