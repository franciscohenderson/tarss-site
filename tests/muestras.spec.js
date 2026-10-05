// @ts-check
const { test, expect } = require('@playwright/test');

// Las cuatro webs de muestra de la portada («Elegí tu rubro»): cada una tiene que abrir sin
// errores y, en las que tienen pedido, el recorrido completo tiene que terminar en un aviso.
// Antes ninguna prueba las abría y un error que las rompía pasó sin que nadie lo viera.
const RUBROS = [
  { name: 'Gimnasio', root: '.demo-root' },
  { name: 'Barbería', root: '.fi', row: '.fi-row', option: '.fi-time', cta: '.fi-cta' },
  { name: 'Restaurante', root: '.br', row: '.br-row', option: '.br-opt', cta: '.br-cta' },
  { name: 'Tienda', root: '.lc', row: '.lc-row', option: '.lc-size', cta: '.lc-cta' },
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
    if (r.row) {
      await phone.locator(r.row).nth(1).click();
      await expect(phone.locator('[role="dialog"]')).toBeVisible();
      await phone.locator(r.option).nth(1).click();
      await phone.locator(r.cta).click();
      await expect(phone.locator('.demo-toast').first()).toBeVisible();
      await expect(phone.locator('[role="dialog"]')).toHaveCount(0);
    }
    expect(errors).toEqual([]);
  });
}
