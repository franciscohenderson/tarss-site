// @ts-check
// Protección del endpoint /api/payment-link (Cloudflare Pages Function).
// El servidor local de los tests (http-server) no ejecuta Functions, así que
// el handler se prueba directo en Node con un Request real.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const nativeImport = new Function('specifier', 'return import(specifier)');
const loadHandler = () => nativeImport(pathToFileURL(path.join(__dirname, '..', 'functions', 'api', 'payment-link.js')).href);

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const call = async (body, env) => {
  const { onRequestPost } = await loadHandler();
  const request = new Request('https://tars.test/api/payment-link', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) });
  return onRequestPost({ request, env });
};

test.describe('Pagos (Cloudflare API)', () => {
  test.skip(({ isMobile }) => isMobile, 'lógica de servidor: alcanza con una corrida');

  test('rechaza pedidos sin servicios (400)', async () => {
    const response = await call({ services: [] }, { NAVE_ENABLED: 'true' });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Elegí al menos un servicio.' });
  });

  test('con los pagos deshabilitados, el endpoint está cerrado (404) aunque el pedido sea válido', async () => {
    const response = await call({ services: ['landing'] }, {});
    expect(response.status).toBe(404);
  });

  test('ignora servicios inventados: sin ninguno válido, 400', async () => {
    const response = await call({ services: ['gratis', 'descuento-100'] }, { NAVE_ENABLED: 'true' });
    expect(response.status).toBe(400);
  });
});

/* ---------------------------------------------------------------------------
   Cotización USD -> ARS: DolarAPI en vivo con respaldo en NAVE_USD_ARS_RATE.
   Ningún test sale a internet: el fetch siempre es simulado. */
const loadNave = () => nativeImport(pathToFileURL(path.join(__dirname, '..', 'functions', '_lib', 'nave.js')).href);

const ENV = {
  NAVE_ENABLED: 'true', NAVE_CLIENT_ID: 'cid', NAVE_CLIENT_SECRET: 'secreto', NAVE_AUDIENCE: 'aud',
  NAVE_POS_ID: 'pos-1', NAVE_USD_ARS_RATE: '1000',
};

/* fetch simulado: Nave responde siempre bien; DolarAPI según `dolar`. */
function fakeFetch(dolar) {
  const calls = [];
  const impl = async (url, init = {}) => {
    calls.push(url);
    if (url.startsWith('https://dolarapi.com/')) return dolar(url, init);
    if (url.includes('apinaranja')) return Response.json({ access_token: 'tok', expires_in: 3600 });
    return Response.json({ id: 'pr_1', checkout_url: 'https://checkout.nave.test/pr_1', status: { name: 'PENDING' }, sent: JSON.parse(init.body) });
  };
  return { impl, calls };
}

test.describe('Cotización USD -> ARS (híbrida)', () => {
  test.skip(({ isMobile }) => isMobile, 'lógica de servidor: alcanza con una corrida');

  test.beforeEach(async () => {
    const { clearRateCache, clearTokenCache } = await loadNave();
    clearRateCache();
    clearTokenCache();
  });

  test('sin acceso a la API externa usa la cotización de respaldo (fallback)', async () => {
    const { naveConfig, getExchangeRate } = await loadNave();
    const { impl, calls } = fakeFetch(async () => { throw new TypeError('fetch failed: sin red'); });

    const exchange = await getExchangeRate(naveConfig(ENV), { fetchImpl: impl });
    expect(exchange).toEqual({ rate: 1000, source: 'env' });
    expect(calls).toEqual(['https://dolarapi.com/v1/dolares/bolsa']); // MEP = «bolsa» en DolarAPI

    // Y el cálculo del cobro usa esa tasa: USD 149 x 1000 = ARS 149000.00
    const { buildPaymentRequest } = await loadNave();
    const { createQuote } = await nativeImport(pathToFileURL(path.join(__dirname, '..', 'js', 'lib', 'quote.js')).href);
    const body = buildPaymentRequest(naveConfig(ENV), createQuote(['landing']), { reference: 'r', siteUrl: 'https://tars.test', rate: exchange.rate });
    expect(body.transactions[0].amount).toEqual({ currency: 'ARS', value: '149000.00' });
  });

  test('con la API disponible usa la cotización en vivo («venta») y la cachea', async () => {
    const { naveConfig, getExchangeRate } = await loadNave();
    const { impl, calls } = fakeFetch(async () => Response.json({ compra: 1180, venta: 1205.5, casa: 'bolsa' }));

    expect(await getExchangeRate(naveConfig(ENV), { fetchImpl: impl })).toEqual({ rate: 1205.5, source: 'dolarapi-mep' });
    expect(await getExchangeRate(naveConfig(ENV), { fetchImpl: impl })).toEqual({ rate: 1205.5, source: 'dolarapi-mep' });
    expect(calls).toHaveLength(1); // la segunda vez sale de la caché
  });

  test('fuente «oficial» configurable', async () => {
    const { naveConfig, getExchangeRate } = await loadNave();
    const { impl, calls } = fakeFetch(async () => Response.json({ venta: 980 }));
    const exchange = await getExchangeRate(naveConfig({ ...ENV, NAVE_RATE_SOURCE: 'oficial' }), { fetchImpl: impl });
    expect(exchange).toEqual({ rate: 980, source: 'dolarapi-oficial' });
    expect(calls).toEqual(['https://dolarapi.com/v1/dolares/oficial']);
  });

  test('datos inválidos o absurdos de la API -> respaldo', async () => {
    const { naveConfig, getExchangeRate } = await loadNave();
    const casos = [
      async () => new Response('<html>error</html>', { status: 200 }), // JSON roto
      async () => Response.json({ venta: 'N/A' }),                        // no numérico
      async () => Response.json({ venta: -5 }),                           // negativo
      async () => new Response('caído', { status: 503 }),                 // error HTTP
      async () => Response.json({ venta: 12 }),                           // 1/83 del respaldo: absurdo
      async () => Response.json({ venta: 1556000 }),                      // x1556: absurdo
    ];
    const warn = console.warn;
    console.warn = () => {};
    for (const dolar of casos) {
      const { clearRateCache } = await loadNave();
      clearRateCache();
      const { impl } = fakeFetch(dolar);
      expect(await getExchangeRate(naveConfig(ENV), { fetchImpl: impl })).toEqual({ rate: 1000, source: 'env' });
    }
    console.warn = warn;
  });

  test('un respaldo viejo (inflación) no descarta una cotización real', async () => {
    const { naveConfig, getExchangeRate } = await loadNave();
    const { impl } = fakeFetch(async () => Response.json({ venta: 1556 })); // +55% sobre 1000
    expect(await getExchangeRate(naveConfig(ENV), { fetchImpl: impl })).toEqual({ rate: 1556, source: 'dolarapi-mep' });
  });

  test('si la API no responde a tiempo, corta y usa el respaldo', async () => {
    const { naveConfig, getExchangeRate } = await loadNave();
    // Nunca responde y además ignora la señal de cancelación.
    const { impl } = fakeFetch(() => new Promise(() => {}));
    const started = Date.now();
    const exchange = await getExchangeRate(naveConfig(ENV), { fetchImpl: impl, timeoutMs: 100 });
    expect(exchange).toEqual({ rate: 1000, source: 'env' });
    expect(Date.now() - started).toBeLessThan(1500);
  });

  test('sin respaldo, una cotización en vivo válida alcanza; sin ninguna, error claro', async () => {
    const { naveConfig, getExchangeRate } = await loadNave();
    const sinRespaldo = { ...ENV, NAVE_USD_ARS_RATE: '' };
    const ok = fakeFetch(async () => Response.json({ venta: 1200 }));
    expect(await getExchangeRate(naveConfig(sinRespaldo), { fetchImpl: ok.impl })).toEqual({ rate: 1200, source: 'dolarapi-mep' });

    const { clearRateCache } = await loadNave();
    clearRateCache();
    const caida = fakeFetch(async () => { throw new Error('sin red'); });
    await expect(getExchangeRate(naveConfig(sinRespaldo), { fetchImpl: caida.impl })).rejects.toThrow('Sin cotización');
  });

  test('el link de pago se crea igual aunque DolarAPI esté caída', async () => {
    const { onRequestPost } = await loadHandler();
    const { impl } = fakeFetch(async () => { throw new Error('DNS caído'); });
    const request = new Request('https://tars.test/api/payment-link', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ services: ['landing', 'seo-local'] }) });

    const response = await onRequestPost({ request, env: ENV }, impl);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.checkout_url).toBe('https://checkout.nave.test/pr_1');
    expect(data.exchange).toEqual({ rate: 1000, source: 'env' });
  });

  test('con NAVE_LIVE_RATE=false no consulta DolarAPI', async () => {
    const { naveConfig, getExchangeRate } = await loadNave();
    const { impl, calls } = fakeFetch(async () => Response.json({ venta: 1200 }));
    expect(await getExchangeRate(naveConfig({ ...ENV, NAVE_LIVE_RATE: 'false' }), { fetchImpl: impl })).toEqual({ rate: 1000, source: 'env' });
    expect(calls).toHaveLength(0);
  });
});

/* ---------------------------------------------------------------------------
   Blindaje (Titán): origen/Content-Type, configuración insegura, timeouts,
   token revocado, piso de cotización y estado transitorio del cliente. */
const postRaw = async (init, env = ENV, fetchImpl) => {
  const { onRequestPost } = await loadHandler();
  const request = new Request('https://tars.test/api/payment-link', { method: 'POST', body: JSON.stringify({ services: ['landing'] }), ...init });
  return onRequestPost({ request, env }, fetchImpl);
};
const loadQuote = () => nativeImport(pathToFileURL(path.join(__dirname, '..', 'js', 'lib', 'quote.js')).href);

test.describe('Blindaje del endpoint y de Nave', () => {
  test.skip(({ isMobile }) => isMobile, 'lógica de servidor: alcanza con una corrida');
  test.beforeEach(async () => { const n = await loadNave(); n.clearRateCache(); n.clearTokenCache(); });

  test('exige Content-Type JSON (una página ajena no puede disparar un cobro con un POST «simple»)', async () => {
    const { impl, calls } = fakeFetch(async () => Response.json({ venta: 1000 }));
    for (const type of ['text/plain;charset=UTF-8', 'application/x-www-form-urlencoded']) {
      const response = await postRaw({ headers: { 'Content-Type': type } }, ENV, impl);
      expect(response.status).toBe(415);
    }
    expect(calls).toHaveLength(0); // ni siquiera se habló con Nave
  });

  test('rechaza un Origin distinto del sitio (403) y acepta el propio o su ausencia', async () => {
    const { impl } = fakeFetch(async () => Response.json({ venta: 1000 }));
    expect((await postRaw({ headers: { ...JSON_HEADERS, Origin: 'https://malo.example' } }, ENV, impl)).status).toBe(403);
    expect((await postRaw({ headers: { ...JSON_HEADERS, Origin: 'https://tars.test' } }, ENV, impl)).status).toBe(200);
    expect((await postRaw({ headers: JSON_HEADERS }, ENV, impl)).status).toBe(200);
  });

  test('NAVE_ENV=production con credenciales faltantes NO cae en «mock»: queda deshabilitado', async () => {
    const { naveConfig } = await loadNave();
    const roto = { ...ENV, NAVE_ENV: 'production', NAVE_CLIENT_SECRET: '' };
    const cfg = naveConfig(roto);
    expect(cfg.enabled).toBe(false);
    expect(cfg.mode).not.toBe('mock');
    const error = console.error; console.error = () => {};
    try { expect((await postRaw({ headers: JSON_HEADERS }, roto)).status).toBe(404); } finally { console.error = error; }
    // en sandbox el modo de prueba sigue funcionando como siempre
    expect(naveConfig({ ...ENV, NAVE_CLIENT_SECRET: '' }).mode).toBe('mock');
  });

  test('NAVE_CURRENCY se normaliza y una moneda inválida deshabilita los cobros', async () => {
    const { naveConfig } = await loadNave();
    expect(naveConfig({ ...ENV, NAVE_CURRENCY: ' usd ' })).toMatchObject({ currency: 'USD', enabled: true });
    expect(naveConfig({ ...ENV, NAVE_CURRENCY: 'EUR' }).enabled).toBe(false);
  });

  test('sin respaldo, una cotización absurda (0,0001, 5 o 10 millones) no se acepta', async () => {
    const { naveConfig, getExchangeRate, clearRateCache } = await loadNave();
    const sinRespaldo = naveConfig({ ...ENV, NAVE_USD_ARS_RATE: '' });
    for (const venta of [0.0001, 5, 10_000_000]) {
      clearRateCache();
      const { impl } = fakeFetch(async () => Response.json({ venta }));
      await expect(getExchangeRate(sinRespaldo, { fetchImpl: impl })).rejects.toThrow('Sin cotización');
    }
  });

  test('Nave colgada: corta por timeout con NaveError 502 en vez de colgar el Worker', async () => {
    const { naveConfig, createPaymentLink, NaveError } = await loadNave();
    const { createQuote } = await loadQuote();
    const cfg = naveConfig({ ...ENV, NAVE_LIVE_RATE: 'false' });
    const started = Date.now();
    const error = await createPaymentLink(cfg, createQuote(['landing']), { reference: 'r', siteUrl: 'https://t.test', timeoutMs: 100 }, () => new Promise(() => {})).catch((e) => e);
    expect(error).toBeInstanceOf(NaveError);
    expect(error.status).toBe(502);
    expect(Date.now() - started).toBeLessThan(1500);
  });

  test('un corte de red hacia Nave es NaveError 502 (no un TypeError que termina en 500)', async () => {
    const { naveConfig, createPaymentLink, NaveError } = await loadNave();
    const { createQuote } = await loadQuote();
    const cfg = naveConfig({ ...ENV, NAVE_LIVE_RATE: 'false' });
    const error = await createPaymentLink(cfg, createQuote(['landing']), { reference: 'r', siteUrl: 'https://t.test' }, async () => { throw new TypeError('fetch failed'); }).catch((e) => e);
    expect(error).toBeInstanceOf(NaveError);
    expect(error.status).toBe(502);
  });

  test('token revocado (401): se descarta la caché y se reintenta una vez; si persiste, error sin bucle', async () => {
    const { naveConfig, createPaymentLink, NaveError, clearTokenCache } = await loadNave();
    const { createQuote } = await loadQuote();
    const cfg = naveConfig({ ...ENV, NAVE_LIVE_RATE: 'false' });
    const opts = { reference: 'r', siteUrl: 'https://t.test' };

    let tokens = 0, creates = 0;
    const revocadoUnaVez = async (url) => {
      if (url.includes('apinaranja')) return Response.json({ access_token: `tok${++tokens}`, expires_in: 3600 });
      creates++;
      return creates === 1 ? new Response('{}', { status: 401 }) : Response.json({ id: 'pr_1', checkout_url: 'https://checkout.nave.test/pr_1' });
    };
    const link = await createPaymentLink(cfg, createQuote(['landing']), opts, revocadoUnaVez);
    expect(link.checkoutUrl).toBe('https://checkout.nave.test/pr_1');
    expect({ tokens, creates }).toEqual({ tokens: 2, creates: 2 });

    clearTokenCache();
    tokens = 0; creates = 0;
    const siempre401 = async (url) => (url.includes('apinaranja') ? Response.json({ access_token: `tok${++tokens}`, expires_in: 3600 }) : (creates++, new Response('{}', { status: 401 })));
    await expect(createPaymentLink(cfg, createQuote(['landing']), opts, siempre401)).rejects.toBeInstanceOf(NaveError);
    expect(creates).toBe(2); // un reintento, no más
  });
});

/* Cliente (js/lib/payments.js): un fallo transitorio no debe apagar «Pagar» toda la sesión. */
const loadPayments = (n) => nativeImport(pathToFileURL(path.join(__dirname, '..', 'js', 'lib', 'payments.js')).href + `?t=${n}`);
test.describe('Cliente de pagos', () => {
  test.skip(({ isMobile }) => isMobile, 'lógica de módulo: alcanza con una corrida');
  const realFetch = globalThis.fetch;
  test.afterEach(() => { globalThis.fetch = realFetch; });

  test('un error de red o 5xx no se cachea: la siguiente consulta se recupera', async () => {
    const { getPaymentStatus } = await loadPayments('a');
    globalThis.fetch = async () => { throw new TypeError('sin red'); };
    expect((await getPaymentStatus()).enabled).toBe(false);
    globalThis.fetch = async () => Response.json({ enabled: true, mode: 'sandbox' });
    expect(await getPaymentStatus()).toMatchObject({ enabled: true, mode: 'sandbox' });

    const second = await loadPayments('b');
    globalThis.fetch = async () => new Response('{}', { status: 503 });
    expect(await second.getPaymentStatus()).toMatchObject({ enabled: false, retry: true });
    globalThis.fetch = async () => Response.json({ enabled: true, mode: 'sandbox' });
    expect((await second.getPaymentStatus()).enabled).toBe(true);
  });

  test('«no hay función» (404) es definitivo: se cachea y no se vuelve a consultar', async () => {
    const { getPaymentStatus } = await loadPayments('c');
    let calls = 0;
    globalThis.fetch = async () => { calls++; return new Response('nope', { status: 404 }); };
    expect(await getPaymentStatus()).toMatchObject({ enabled: false });
    await getPaymentStatus();
    expect(calls).toBe(1);
  });
});
