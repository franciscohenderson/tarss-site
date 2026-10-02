// @ts-check
// Prueba de imprenta: el nombre del negocio se imprime en la hoja, en el
// celular de muestra, en el pedido por WhatsApp y en el titular del inicio.
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
});

test('escribir el nombre lo imprime en la hoja, el celular, el pedido y el titular', async ({ page }) => {
  await page.goto('/index.html#prueba');
  const sheet = page.locator('.proof-sheet');
  await expect(sheet).toHaveAttribute('aria-hidden', 'true');
  await expect(sheet.locator('.proof-sample')).toHaveText('Muestra de diseño · negocio de ejemplo');
  // Antes de escribir: negocio de ejemplo del rubro elegido.
  await expect(sheet.locator('.proof-name')).toHaveText('Brasa & Vid');

  await page.getByLabel('¿Cómo se llama tu negocio?').fill('Panadería Lola');
  await expect(sheet.locator('.proof-name')).toHaveText('Panadería Lola');
  await expect(sheet.locator('.pf-name')).toHaveText('Panadería Lola');
  await expect(page.locator('.hero-lead')).toHaveText('Ayudo a Panadería Lola a');
  await expect(page.locator('#proof-status')).toContainText('Panadería Lola');

  const request = page.locator('#proof-request');
  await expect(request).toHaveText('Quiero la web de Panadería Lola');
  const href = decodeURIComponent(await request.getAttribute('href') || '');
  expect(href).toContain('wa.me/5492612408064');
  expect(href).toContain('quiero una web para Panadería Lola (restaurante)');
});

test('cambiar de rubro cambia la pantalla de muestra y se mide una vez', async ({ page }) => {
  await page.goto('/index.html#prueba');
  const screen = page.locator('.proof-screen');
  for (const [label, kind, text] of [['Local de ropa', 'ropa', 'Agregar al carrito'], ['Barbería', 'barberia', 'Corte + barba'], ['Gimnasio', 'gimnasio', 'CARNET DIGITAL'], ['Otro', 'otro', 'SERVICIOS']]) {
    await page.getByLabel(label).check();
    await expect(screen).toHaveAttribute('data-kind', kind);
    await expect(screen).toContainText(text);
  }
  const events = await page.evaluate(() => window.dataLayer.filter((event) => event.event === 'proof_preview'));
  expect(events).toHaveLength(1);
  expect(events[0].kind).toBe('ropa');
});

test('el nombre se escapa: no se interpreta como HTML', async ({ page }) => {
  await page.goto('/index.html#prueba');
  await page.getByLabel('¿Cómo se llama tu negocio?').fill('<img src=x onerror=alert(1)>');
  await expect(page.locator('.proof-screen img[src="x"]')).toHaveCount(0);
  await expect(page.locator('.proof-screen .pf-name')).toContainText('<img');
});

test('el celular de muestra entra en la hoja sin scroll horizontal', async ({ page }) => {
  await page.goto('/index.html#prueba');
  await page.locator('.proof-sheet').scrollIntoViewIfNeeded();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const fits = await page.evaluate(() => {
    const sheet = document.querySelector('.proof-sheet').getBoundingClientRect();
    const phone = document.querySelector('.proof-phone').getBoundingClientRect();
    return phone.left >= sheet.left && phone.right <= sheet.right + 1;
  });
  expect(fits).toBe(true);
});

test('con «reducir movimiento» la entrada del hero no anima', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
  await page.goto('/index.html');
  const animation = await page.evaluate(() => getComputedStyle(document.querySelector('.hero .riso-word'), '::before').animationName);
  expect(animation).toBe('none');
  await context.close();
});
