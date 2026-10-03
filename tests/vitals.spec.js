// @ts-check
// Proyectos de muestra y medición de Core Web Vitals.
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
});

test.describe('Core Web Vitals', () => {
  test('LCP y CLS llegan al dataLayer con el esquema acordado', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'las APIs de LCP/CLS son de Chromium');
    await page.goto('/index.html');
    // El módulo se carga solo después de load + momento ocioso.
    await expect.poll(() => page.evaluate(() =>
      performance.getEntriesByType('resource').some((r) => r.name.includes('web-vitals.attribution.js'))),
    { timeout: 20000 }).toBe(true); // margen: la suite corre en paralelo con un test de celular lento
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

  test("en un celular lento, lo de abajo no salta cuando JS arma el hero (CLS < 0.05)", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "layout-shift y CDP son de Chromium");
    // Con red lenta y el procesador 6 veces más lento, el primer pintado llega antes que
    // los paneles (que arma JS). Sin el alto reservado del hero daba CLS 0,90.
    await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 100000 });
    await page.addInitScript(() => {
      window.__cls = 0;
      new PerformanceObserver((list) => list.getEntries().forEach((e) => { if (!e.hadRecentInput) window.__cls += e.value; }))
        .observe({ type: "layout-shift", buffered: true });
    });
    await page.goto("/index.html", { waitUntil: "load" });
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => window.__cls)).toBeLessThan(0.05);
  });
});
