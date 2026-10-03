// @ts-check
// Modelo del PDF (lógica pura, en Node) + visibilidad de las acciones del
// ticket en el navegador (con y sin JavaScript).
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

// import() nativo: el runner de Playwright convierte import() en require(),
// y Node no permite require() de módulos ES encadenados (pdf.js -> quote.js).
const nativeImport = new Function('specifier', 'return import(specifier)');
const load = (file) => nativeImport(pathToFileURL(path.join(__dirname, '..', 'js', 'lib', file)).href);

test.describe('pdf.js (sin navegador)', () => {
  test.skip(({ isMobile }) => isMobile, 'lógica pura: alcanza con una corrida');

  test('construye el modelo del presupuesto correctamente', async () => {
    const { createQuote } = await load('quote.js');
    const { documentModel } = await load('pdf.js');

    const model = documentModel('presupuesto', createQuote(['landing']), { reference: 'P-20261001-TEST' });
    expect(model.title).toBe('PRESUPUESTO');
    expect(model.rows[0]).toEqual(['Landing Page', 'Pago único', 'USD 149']);
    expect(model.totals[0]).toEqual(['Pago único', 'USD 149']);
    expect(model.totals[1]).toEqual(['Por mes', 'USD 0/mes']);
  });
});

test.describe('acciones del ticket en el navegador', () => {
  test('aparecen cuando carga su módulo', async ({ page }) => {
    await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
    await page.goto('/servicios.html');
    await expect(page.locator('#ticket-actions')).toBeVisible();
    await expect(page.locator('#ticket-pdf')).toBeDisabled(); // ticket vacío
  });

  test('sin JavaScript no se muestran (no funcionarían)', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
    await page.goto('/servicios.html');
    await expect(page.locator('#ticket-actions')).toBeHidden();
    await context.close();
  });
});
