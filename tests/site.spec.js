// @ts-check
const { test, expect } = require('@playwright/test');

const PAGES = [
  { path: '/index.html', h1: /Webs para/ },
  { path: '/servicios.html' },
  { path: '/contacto.html', h1: 'Contacto' },
  { path: '/blog.html' },
  { path: '/privacidad.html' },
  { path: '/gracias.html' },
  { path: '/404.html' },
  { path: '/articulo-landing-profesional.html', h1: /landing profesional/ },
  { path: '/articulo-sitio-en-celular.html', h1: /celular/ },
  { path: '/articulo-mantenimiento-web.html', h1: /mantenimiento web/ },
];

// Los tests no deben depender de terceros ni ensuciar las métricas reales:
// se cortan GTM, el píxel de Meta y cualquier otra petición externa.
test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
});

test.describe('Todas las páginas', () => {
  for (const { path, h1 } of PAGES) {
    test(`${path} carga sin errores de JS`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));

      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page).toHaveTitle(/Tars/);
      await expect(page.locator('h1')).toHaveCount(1);
      if (h1) await expect(page.locator('h1')).toHaveAccessibleName(h1);
      expect(errors).toEqual([]);
    });

    test(`${path} no tiene enlaces internos rotos`, async ({ page, request }) => {
      await page.goto(path);
      const hrefs = await page.locator('a[href]').evaluateAll((links) =>
        links.map((a) => a.getAttribute('href') || ''));

      const internal = [...new Set(hrefs
        .filter((href) => !/^(https?:|mailto:|tel:|#)/.test(href))
        .map((href) => href.split('#')[0])
        .filter(Boolean))];

      for (const href of internal) {
        const res = await request.get(new URL(href, `http://localhost:4173${path}`).href);
        expect(res.status(), `enlace roto: ${href}`).toBe(200);
      }
    });

    test(`${path} tiene meta description y canonical`, async ({ page }) => {
      test.skip(path === '/404.html' || path === '/gracias.html', 'páginas fuera del índice');
      await page.goto(path);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.{30,}/);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /^https:\/\//);
    });
  }
});

test.describe('Navegación', () => {
  test('el enlace de salto lleva al contenido principal', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page.locator('#main-content')).toHaveCount(1);
    await page.keyboard.press('Tab');
    await expect(page.locator('.skip-link')).toBeFocused();
  });

  test('el menú hamburguesa abre y cierra en mobile', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'el botón solo se muestra en pantallas chicas');
    await page.goto('/servicios.html');

    const toggle = page.locator('.nav-toggle');
    const links = page.locator('#primary-navigation');

    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(links).toBeHidden();

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(links).toBeVisible();

    // Elegir un enlace cierra el menú.
    await links.getByRole('link', { name: 'Blog' }).click();
    await expect(page).toHaveURL(/blog\.html/);
  });
});

// El sitio es solo oscuro desde el rediseño (2026-10): sin botón de tema.

test.describe('Formulario de contacto', () => {
  async function fillForm(page) {
    const form = page.locator('#contact-form');
    await form.locator('input[name="name"]').fill('Prueba Playwright');
    await form.locator('input[name="_replyto"]').fill('prueba@example.com');
    await form.locator('textarea[name="message"]').fill('Mensaje de prueba automatizada.');
    return form;
  }

  test('no se envía con campos obligatorios vacíos', async ({ page }) => {
    let sent = false;
    await page.route('https://formspree.io/**', (route) => { sent = true; return route.abort(); });
    await page.goto('/contacto.html');

    await page.locator('#contact-form button[type="submit"]').click();
    expect(sent).toBe(false);
    const valid = await page.locator('#contact-form').evaluate((f) => f.checkValidity());
    expect(valid).toBe(false);
  });

  test('envío exitoso muestra confirmación y lleva a gracias.html', async ({ page }) => {
    await page.route('https://formspree.io/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
    await page.goto('/contacto.html');

    const form = await fillForm(page);
    await form.locator('button[type="submit"]').click();

    await expect(page.getByText('¡Mensaje enviado!')).toBeVisible();
    await expect(form.locator('button[type="submit"]')).toBeDisabled();
    await expect(page).toHaveURL(/gracias\.html/, { timeout: 5000 });
  });

  test('error del servidor muestra aviso y rehabilita el botón', async ({ page }) => {
    await page.route('https://formspree.io/**', (route) =>
      route.fulfill({ status: 422, contentType: 'application/json', body: '{"error":"Email inválido"}' }));
    await page.goto('/contacto.html');

    const form = await fillForm(page);
    await form.locator('button[type="submit"]').click();

    await expect(page.getByText('Email inválido')).toBeVisible();
    await expect(form.locator('button[type="submit"]')).toBeEnabled();
    await expect(page).toHaveURL(/contacto\.html/);
  });
});

test.describe('Responsive', () => {
  for (const path of PAGES.map((p) => p.path)) {
    test(`${path} no tiene scroll horizontal`, async ({ page }) => {
      await page.goto(path);
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
});
