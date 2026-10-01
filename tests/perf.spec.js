// @ts-check
// Fase 2 del roadmap: code splitting. Cada página descarga solo los módulos
// de JavaScript que usa (import dinámico desde js/main.js).
const { test, expect } = require('@playwright/test');

const EXPECTED = {
  '/index.html': { loads: ['register.js'], skips: ['contact-form.js', 'runaway.js'] },
  '/servicios.html': { loads: ['register.js'], skips: ['contact-form.js', 'runaway.js'] },
  '/contacto.html': { loads: ['contact-form.js', 'toast.js'], skips: ['register.js', 'runaway.js'] },
  '/blog.html': { loads: [], skips: ['register.js', 'contact-form.js', 'runaway.js', 'toast.js'] },
  '/404.html': { loads: ['runaway.js'], skips: ['register.js', 'contact-form.js'] },
};

for (const [path, { loads, skips }] of Object.entries(EXPECTED)) {
  test(`${path} descarga solo los módulos que usa`, async ({ page }) => {
    await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
    const scripts = [];
    page.on('request', (request) => {
      if (request.resourceType() === 'script') scripts.push(new URL(request.url()).pathname);
    });
    await page.goto(path);
    await page.waitForLoadState('networkidle');

    const names = scripts.map((s) => s.split('/').pop());
    for (const name of loads) expect(names, `debería cargar ${name}`).toContain(name);
    for (const name of skips) expect(names, `no debería cargar ${name}`).not.toContain(name);
  });
}
