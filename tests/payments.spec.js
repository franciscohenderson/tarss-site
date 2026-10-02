// @ts-check
// Protección del endpoint /api/payment-link (Cloudflare Pages Function).
// El servidor local de los tests (http-server) no ejecuta Functions, así que
// el handler se prueba directo en Node con un Request real.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const nativeImport = new Function('specifier', 'return import(specifier)');
const loadHandler = () => nativeImport(pathToFileURL(path.join(__dirname, '..', 'functions', 'api', 'payment-link.js')).href);

const call = async (body, env) => {
  const { onRequestPost } = await loadHandler();
  const request = new Request('https://tars.test/api/payment-link', { method: 'POST', body: JSON.stringify(body) });
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
    const request = new Request('https://tars.test/api/payment-link', { method: 'POST', body: JSON.stringify({ services: ['landing', 'seo-local'] }) });

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
