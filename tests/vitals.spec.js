// @ts-check
// Proyectos de muestra y medición de Core Web Vitals.
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
});

test.describe('Proyectos de muestra', () => {
  test('tres maquetas rotuladas como muestra, sin clientes', async ({ page }) => {
    await page.goto('/index.html#casos');
    const section = page.locator('#casos');
    await expect(section.getByRole('heading', { level: 2 })).toHaveText('Proyectos de muestra');
    const demos = section.locator('article.demo');
    await expect(demos).toHaveCount(3);
    for (const demo of await demos.all()) {
      await expect(demo.locator('dd').first()).toHaveText('Maqueta de demostración');
      // El dibujo es decorativo: no lo lee el lector de pantalla.
      await expect(demo.locator('.mock')).toHaveAttribute('aria-hidden', 'true');
    }
    await expect(section).not.toContainText(/cliente real|testimonio/i);
  });

  test('cada maqueta se pide por WhatsApp con su nombre y se mide', async ({ page }) => {
    await page.goto('/index.html');
    const link = page.getByRole('link', { name: 'Quiero una landing así' });
    await expect(link).toHaveAttribute('href', /wa\.me\/5492617459362\?text=.*landing/);
    // Al enfocar con teclado, las planchas entran en registro.
    await link.focus();
    await expect(link).toBeFocused();
    await expect.poll(() => link.evaluate((el) =>
      getComputedStyle(el.closest('.demo').querySelector('.plate--pink')).transform)).toMatch(/none|matrix\(1, 0, 0, 1, 0, 0\)/);
    await page.context().route('https://wa.me/**', (route) => route.abort());
    await link.click();
    const events = await page.evaluate(() => window.dataLayer.filter((e) => e.event === 'whatsapp_click'));
    expect(events.at(-1).link_text).toBe('Quiero una landing así');
  });

  test('no hay scroll horizontal en la sección', async ({ page }) => {
    await page.goto('/index.html#casos');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe('Core Web Vitals', () => {
  test('LCP y CLS llegan al dataLayer con el esquema acordado', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'las APIs de LCP/CLS son de Chromium');
    await page.goto('/index.html');
    // El módulo se carga solo después de load + momento ocioso.
    await expect.poll(() => page.evaluate(() =>
      performance.getEntriesByType('resource').some((r) => r.name.includes('web-vitals.attribution.js'))),
    { timeout: 10000 }).toBe(true);
    await page.mouse.click(5, 300); // una interacción: cierra el LCP y da un INP
    await page.waitForTimeout(300);
    // Simula que la persona cambia de pestaña: ahí se reportan los valores finales.
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const vitals = await page.evaluate(() => window.dataLayer.filter((e) => e.event === 'web_vitals'));
    const names = vitals.map((v) => v.metric_name);
    expect(names).toContain('LCP');
    expect(names).toContain('CLS');
    for (const v of vitals) {
      expect(Object.keys(v).sort()).toEqual(['debug_target', 'event', 'metric_id', 'metric_name',
        'metric_rating', 'metric_value', 'navigation_type', 'page_path'].sort());
      expect(['good', 'needs-improvement', 'poor']).toContain(v.metric_rating);
      expect(typeof v.metric_value).toBe('number');
    }
    const lcp = vitals.find((v) => v.metric_name === 'LCP');
    expect(Number.isInteger(lcp.metric_value)).toBe(true);
    expect(lcp.debug_target).not.toBe('');
  });

  test('web-vitals no se descarga antes del evento load', async ({ page }) => {
    const order = [];
    page.on('request', (r) => { if (r.url().includes('web-vitals')) order.push('vitals'); });
    page.on('load', () => order.push('load'));
    await page.goto('/index.html');
    await expect.poll(() => order.includes('vitals'), { timeout: 10000 }).toBe(true);
    expect(order.indexOf('load')).toBeLessThan(order.indexOf('vitals'));
  });
test("el hero no salta aunque la fuente llegue tarde (CLS 0)", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "layout-shift es una API de Chromium");
    // Fuente demorada 1,5 s: con font-display swap esto daba CLS 0,25.
    await page.route("**/*.woff2", async (route) => { await new Promise((ok) => setTimeout(ok, 1500)); await route.continue(); });
    await page.goto("/index.html", { waitUntil: "load" });
    await page.waitForTimeout(500);
    const cls = await page.evaluate(() => new Promise((resolve) => {
      let total = 0;
      new PerformanceObserver((list) => list.getEntries().forEach((e) => { if (!e.hadRecentInput) total += e.value; }))
        .observe({ type: "layout-shift", buffered: true });
      setTimeout(() => resolve(total), 100);
    }));
    expect(cls).toBeLessThan(0.01);
  });
});
