// @ts-check
const { test, expect } = require('@playwright/test');

// Las cinco webs de muestra de la portada («Elegí tu rubro»): cada una tiene que abrir sin
// errores y el recorrido completo (elegir, cuándo o cómo, confirmar) tiene que terminar en un aviso.
// Los pasos son clics dentro del celular de la muestra, en orden.
const RUBROS = [
  { name: 'Gimnasio', root: '.pm', steps: ['.pm-start', '.pm-bar button >> nth=0', '.pm-list button >> nth=0', '.pm-slot >> nth=0', '.pm-cta'] },
  { name: 'Peluquería', root: '.ru', steps: ['.ru-row >> nth=1', '.ru-pick >> nth=2', '.ru-time >> nth=1', '.ru-cta'] },
  { name: 'Restaurante', root: '.ga', steps: ['.ga-row >> nth=0', '.ga-opt >> nth=1', '.ga-cta'] },
  { name: 'Tienda', root: '.jc', steps: ['.jc-links button >> nth=0', '.jc-size >> nth=2', '.jc-cta'] },
  { name: 'Manicura', root: '.el', steps: ['.el-turno', '.el-day >> nth=1', '.el-time >> nth=2', '.el-confirm'] },
];

// En los navegadores de prueba el 3D se dibuja sin placa de video (lento): estas pruebas van en
// fila y con más tiempo, para que el resto de la suite en paralelo no las ahogue.
test.describe.configure({ mode: 'serial', timeout: 120000 });

for (const r of RUBROS) {
  test(`la muestra de ${r.name} abre y funciona`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/#rubros');
    const pick = page.getByText(r.name, { exact: true }).first();
    await pick.scrollIntoViewIfNeeded();
    await pick.click();
    const phone = page.locator('[data-phone]');
    await expect(phone.locator(r.root)).toBeVisible({ timeout: 15000 });
    for (const step of r.steps) {
      const target = phone.locator(step).first();
      await target.scrollIntoViewIfNeeded();
      await target.click();
    }
    await expect(phone.locator('.demo-toast').first()).toBeVisible();
    await expect(phone.locator('[role="dialog"]')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

// La tienda además suma a la bolsa y compra de verdad.
test('la tienda suma a la bolsa y confirma la compra', async ({ page }) => {
  await page.goto('/#rubros');
  const pick = page.getByText('Tienda', { exact: true }).first();
  await pick.scrollIntoViewIfNeeded();
  await pick.click();
  const phone = page.locator('[data-phone]');
  await expect(phone.locator('.jc')).toBeVisible({ timeout: 15000 });
  await phone.locator('.jc-links button').nth(3).click();
  await phone.locator('.jc-size').first().click();
  await phone.locator('.jc-cta').click();
  await expect(phone.locator('.jc-bagbtn')).toContainText('1');
  await phone.locator('.jc-bagbtn').click();
  await expect(phone.locator('.jc-lines li')).toHaveCount(1);
  await phone.locator('.jc-bag .jc-cta').click();
  await expect(phone.getByText(/Pedido JC-\d+ confirmado/)).toBeVisible();
});
