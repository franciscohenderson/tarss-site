// @ts-check
// Fase 3 del roadmap: la lógica del presupuesto vive en js/lib/quote.js
// (módulo puro, sin DOM) y se prueba directo en Node, sin navegador.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

// import() nativo (ver tests/integrations.spec.js).
const nativeImport = new Function('specifier', 'return import(specifier)');
const load = () => nativeImport(pathToFileURL(path.join(__dirname, '..', 'js', 'lib', 'quote.js')).href);

test.describe('quote.js (sin navegador)', () => {
  test.skip(({ isMobile }) => isMobile, 'lógica pura: alcanza con correrla una vez');

  test('presupuesto vacío', async () => {
    const { createQuote } = await load();
    const quote = createQuote([]);
    expect(quote.isEmpty).toBe(true);
    expect(quote.oneTime).toBe(0);
    expect(quote.monthly).toBe(0);
    expect(quote.totalText).toBe('USD 0');
  });

  test('pago único y mensual van por separado', async () => {
    const { createQuote } = await load();
    const quote = createQuote(['landing', 'mantenimiento', 'seo-local']);
    expect(quote.oneTime).toBe(229);
    expect(quote.monthly).toBe(50);
    expect(quote.totalText).toBe('USD 229 + USD 50/mes');
    expect(quote.count).toBe(3);
  });

  test('ignora ids desconocidos y repetidos, y respeta el orden del catálogo', async () => {
    const { createQuote } = await load();
    const quote = createQuote(['seo-local', 'hackeo', 'landing', 'landing']);
    expect(quote.items.map((i) => i.id)).toEqual(['landing', 'seo-local']);
    expect(quote.oneTime).toBe(229);
  });

  test('el presupuesto y el catálogo son inmutables', async () => {
    const { createQuote, CATALOG } = await load();
    const quote = createQuote(['landing']);
    expect(Object.isFrozen(quote)).toBe(true);
    expect(Object.isFrozen(CATALOG.landing)).toBe(true);
    expect(() => { 'use strict'; CATALOG.landing.price = 1; }).toThrow();
  });

  test('mensaje y link de WhatsApp', async () => {
    const { createQuote, buildWhatsAppMessage, buildWhatsAppUrl } = await load();
    const quote = createQuote(['landing', 'mantenimiento']);
    expect(buildWhatsAppMessage(quote)).toBe([
      '¡Hola! Quiero solicitar este presupuesto de Tars:',
      '',
      '• Landing Page: USD 149',
      '• Mantenimiento: USD 50/mes',
      '',
      'Total estimado: USD 149 + USD 50/mes',
    ].join('\n'));
    const url = new URL(buildWhatsAppUrl(quote, '5492612408064'));
    expect(url.origin + url.pathname).toBe('https://wa.me/5492612408064');
    expect(url.searchParams.get('text')).toBe(buildWhatsAppMessage(quote));
  });

  test('evento quote_request para GTM', async () => {
    const { createQuote, quoteAnalytics } = await load();
    expect(quoteAnalytics(createQuote(['mantenimiento', 'seo-local']))).toEqual({
      currency: 'USD', value: 80, monthly_value: 50, services: 'Mantenimiento, SEO Local',
    });
  });
});

test.describe('registradora en el navegador', () => {
  test('desmarcar una tecla saca su renglón y recalcula', async ({ page }) => {
    await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
    await page.goto('/servicios.html');
    const keys = page.locator('#ticket-form input[name="service"]');
    await keys.nth(0).check({ force: true });
    await keys.nth(2).check({ force: true });
    await expect(page.locator('#ticket-live')).toHaveText('Total: USD 229');
    await keys.nth(0).uncheck({ force: true });
    await expect(page.locator('#ticket-live')).toHaveText('Total: USD 80');
    await expect(page.locator('#ticket-lines li[data-id]')).toHaveCount(1);
    await expect(page.locator('#ticket-lines li[data-id="seo-local"]')).toBeVisible();
  });
});
