// @ts-check
// Fase 4 del roadmap: PDF (presupuesto y remito) y links de cobro con Nave.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const root = path.join(__dirname, '..');
// import() nativo: el runner de Playwright transforma import() en require(),
// y Node no permite require() de módulos ES encadenados (pdf.js -> quote.js).
const nativeImport = new Function('specifier', 'return import(specifier)');
const load = (rel) => nativeImport(pathToFileURL(path.join(root, rel)).href);

/* ------------------------------------------------------------------ Node */
test.describe('PDF y cobros (sin navegador)', () => {
  test.skip(({ isMobile }) => isMobile, 'lógica de servidor/pura: alcanza con una corrida');

  test('modelo del presupuesto', async () => {
    const { createQuote } = await load('js/lib/quote.js');
    const { documentModel } = await load('js/lib/pdf.js');
    const model = documentModel('presupuesto', createQuote(['landing', 'mantenimiento']), {
      date: new Date(2026, 9, 1), reference: 'P-20261001-TEST',
    });
    expect(model.title).toBe('PRESUPUESTO');
    expect(model.filename).toBe('presupuesto-tars-P-20261001-TEST.pdf');
    expect(model.date).toBe('01/10/2026');
    expect(model.rows).toEqual([
      ['Landing Page', 'Pago único', 'USD 149'],
      ['Mantenimiento', 'Mensual', 'USD 50/mes'],
    ]);
    expect(model.totals).toEqual([['Pago único', 'USD 149'], ['Por mes', 'USD 50/mes']]);
  });

  test('modelo del remito: sin importes y con firma', async () => {
    const { createQuote } = await load('js/lib/quote.js');
    const { documentModel, createReference } = await load('js/lib/pdf.js');
    const model = documentModel('remito', createQuote(['landing', 'seo-local']), { date: new Date(2026, 9, 1) });
    expect(model.title).toBe('REMITO');
    expect(model.reference).toMatch(/^R-20261001-[2-9A-HJ-NP-Z]{4}$/);
    expect(JSON.stringify(model.rows)).not.toContain('USD');
    expect(model.signature).toContain('Recibí conforme (firma)');
    expect(createReference('presupuesto', new Date(2026, 0, 5), () => 'ABCD')).toBe('P-20260105-ABCD');
  });

  test('no se genera un documento vacío', async () => {
    const { createQuote } = await load('js/lib/quote.js');
    const { documentModel } = await load('js/lib/pdf.js');
    expect(() => documentModel('presupuesto', createQuote([]))).toThrow('al menos un servicio');
    expect(() => documentModel('factura', createQuote(['landing']))).toThrow('desconocido');
  });

  test('el PDF se dibuja con jsPDF e incluye los renglones', async () => {
    const { jsPDF } = require('jspdf');
    const { createQuote } = await load('js/lib/quote.js');
    const { documentModel, renderDocument } = await load('js/lib/pdf.js');
    const model = documentModel('presupuesto', createQuote(['landing', 'seo-local']), { reference: 'P-20261001-TEST' });
    const pdf = renderDocument(jsPDF, model).output();
    expect(pdf.startsWith('%PDF-')).toBe(true);
    for (const text of ['PRESUPUESTO', 'Landing Page', 'SEO Local', 'USD 229', 'P-20261001-TEST']) expect(pdf).toContain(text);
  });

  const post = (body, env, fetchImpl) => load('functions/api/payment-link.js').then(({ onRequestPost }) =>
    onRequestPost({ request: new Request('https://tars.test/api/payment-link', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }), env }, fetchImpl));

  test('GET: deshabilitado por defecto y en modo simulado sin claves', async () => {
    const { onRequestGet } = await load('functions/api/payment-link.js');
    expect(await onRequestGet({ env: {} }).json()).toEqual({ enabled: false, mode: 'mock' });
    expect(await onRequestGet({ env: { NAVE_ENABLED: 'true' } }).json()).toEqual({ enabled: true, mode: 'mock' });
  });

  test('POST: validaciones', async () => {
    const env = { NAVE_ENABLED: 'true' };
    expect((await post({ services: ['landing'] }, {})).status).toBe(404); // deshabilitado
    expect((await post('{no es json', env)).status).toBe(400);
    expect((await post({ services: [] }, env)).status).toBe(400);
    expect((await post({ services: ['mantenimiento'] }, env)).status).toBe(422); // solo mensual
    expect((await post({ services: ['landing'], buyer: { email: 'nope' } }, env)).status).toBe(400);
    expect((await post('x'.repeat(5000), env)).status).toBe(413);
  });

  test('POST simulado: el importe lo calcula el servidor (no se puede manipular)', async () => {
    const response = await post({ services: ['landing', 'mantenimiento'], price: 1, amount: 1 }, { NAVE_ENABLED: 'true' });
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.mock).toBe(true);
    expect(data.amount).toEqual({ currency: 'USD', value: 149 }); // solo pago único
    expect(data.checkout_url).toMatch(/^https:\/\/tars\.test\/gracias\.html\?pago=simulado&ref=tars-/);
  });

  test('POST real (sandbox): token cacheado y cuerpo con la estructura de Nave', async () => {
    const { clearTokenCache } = await load('functions/_lib/nave.js');
    clearTokenCache();
    const env = {
      NAVE_ENABLED: 'true', NAVE_CLIENT_ID: 'cid', NAVE_CLIENT_SECRET: 'secreto', NAVE_AUDIENCE: 'aud',
      NAVE_POS_ID: 'pos-1', NAVE_USD_ARS_RATE: '1000',
    };
    const calls = [];
    const fakeFetch = async (url, init) => {
      calls.push({ url, init, body: JSON.parse(init.body) });
      if (url.includes('apinaranja')) return Response.json({ access_token: 'tok', expires_in: 3600 });
      return Response.json({ id: 'pr_1', checkout_url: 'https://checkout.nave.test/pr_1', status: { name: 'PENDING' } });
    };

    const first = await (await post({ services: ['landing', 'seo-local'], buyer: { name: 'Ana', email: 'ana@example.com' } }, env, fakeFetch)).json();
    await post({ services: ['landing'] }, env, fakeFetch);

    expect(first).toMatchObject({ id: 'pr_1', checkout_url: 'https://checkout.nave.test/pr_1', mock: false, mode: 'sandbox' });
    const tokenCalls = calls.filter((c) => c.url.includes('apinaranja'));
    expect(tokenCalls).toHaveLength(1); // el segundo cobro reusa el token
    expect(tokenCalls[0].url).toBe('https://homoservices.apinaranja.com/security-ms/api/security/auth0/b2b/m2ms');
    expect(tokenCalls[0].body).toEqual({ client_id: 'cid', client_secret: 'secreto', audience: 'aud' });

    const payment = calls.find((c) => c.url.endsWith('/payment_request/ecommerce'));
    expect(payment.url).toBe('https://api-sandbox.ranty.io/api/payment_request/ecommerce');
    expect(payment.init.headers.Authorization).toBe('Bearer tok');
    expect(payment.body.seller).toEqual({ pos_id: 'pos-1' });
    expect(payment.body.transactions[0].amount).toEqual({ currency: 'ARS', value: '229000.00' });
    expect(payment.body.transactions[0].products.map((p) => p.name)).toEqual(['Landing Page', 'SEO Local']);
    expect(payment.body.buyer).toEqual({ name: 'Ana', user_email: 'ana@example.com' });
    expect(payment.body.additional_info.callback_url).toBe('https://tars.test/gracias.html');
  });

  test('POST real: si Nave falla, el navegador recibe un mensaje genérico (sin secretos)', async () => {
    const { clearTokenCache } = await load('functions/_lib/nave.js');
    clearTokenCache();
    const env = { NAVE_ENABLED: 'true', NAVE_CLIENT_ID: 'cid', NAVE_CLIENT_SECRET: 'super-secreto', NAVE_AUDIENCE: 'aud', NAVE_POS_ID: 'p', NAVE_USD_ARS_RATE: '1000' };
    const failing = async () => new Response('{"message":"invalid client super-secreto"}', { status: 401 });
    const originalError = console.error;
    console.error = () => {};
    const response = await post({ services: ['landing'] }, env, failing);
    console.error = originalError;
    const text = await response.text();
    expect(response.status).toBe(502);
    expect(text).not.toContain('super-secreto');
    expect(text).toContain('No se pudo generar el link de pago');
  });
});

/* ------------------------------------------------------------- Navegador */
test.describe('acciones del ticket', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
  });

  test('descarga el presupuesto en PDF y jsPDF se baja recién al pedirlo', async ({ page }) => {
    const requested = [];
    page.on('request', (r) => requested.push(r.url()));
    await page.goto('/servicios.html');
    const pdf = page.locator('#ticket-pdf');
    await expect(pdf).toBeDisabled();

    await page.locator('#ticket-form input[data-service="landing"]').check({ force: true });
    await expect(pdf).toBeEnabled();
    expect(requested.some((u) => u.includes('jspdf'))).toBe(false);

    const [download] = await Promise.all([page.waitForEvent('download'), pdf.click()]);
    expect(download.suggestedFilename()).toMatch(/^presupuesto-tars-P-\d{8}-[2-9A-HJ-NP-Z]{4}\.pdf$/);
    expect(requested.some((u) => u.includes('/vendor/jspdf/jspdf.umd.min.js'))).toBe(true);
    await expect(page.locator('.toast--success')).toContainText('descargado');
    await expect(pdf).toHaveText('Descargar PDF');
  });

  test('sin la API de pagos, el botón «Pagar» no aparece', async ({ page }) => {
    await page.goto('/index.html');
    await page.locator('#ticket-form input[data-service="landing"]').check({ force: true });
    await page.waitForTimeout(300);
    await expect(page.locator('#ticket-pay')).toBeHidden();
  });

  test('con pagos habilitados: «Pagar» lleva al checkout (y se apaga con solo mensuales)', async ({ page }) => {
    await page.route('**/api/payment-link', (route) => {
      if (route.request().method() === 'GET') return route.fulfill({ json: { enabled: true, mode: 'mock' } });
      const body = route.request().postDataJSON();
      expect(body).toEqual({ services: ['landing'] }); // el navegador solo manda ids
      return route.fulfill({ json: { id: 'mock_1', checkout_url: '/gracias.html?pago=simulado', mock: true, mode: 'mock' } });
    });
    await page.goto('/index.html');
    const pay = page.locator('#ticket-pay');

    await page.locator('#ticket-form input[data-service="mantenimiento"]').check({ force: true });
    await expect(pay).toBeVisible();
    await expect(pay).toBeDisabled(); // solo mensual: no se cobra online

    await page.locator('#ticket-form input[data-service="mantenimiento"]').uncheck({ force: true });
    await page.locator('#ticket-form input[data-service="landing"]').check({ force: true });
    await expect(pay).toBeEnabled();
    await pay.click();
    await expect(page).toHaveURL(/gracias\.html\?pago=simulado/);
  });

  test('si el cobro falla, avisa y el botón vuelve a estar disponible', async ({ page }) => {
    await page.route('**/api/payment-link', (route) => route.request().method() === 'GET'
      ? route.fulfill({ json: { enabled: true, mode: 'sandbox' } })
      : route.fulfill({ status: 502, json: { error: 'No se pudo generar el link de pago.' } }));
    await page.goto('/index.html');
    await page.locator('#ticket-form input[data-service="landing"]').check({ force: true });
    const pay = page.locator('#ticket-pay');
    await pay.click();
    await expect(page.getByRole('alert')).toContainText('No se pudo generar el link de pago');
    await expect(pay).toBeEnabled();
    await expect(pay).toHaveText('Pagar ahora');
  });
});
