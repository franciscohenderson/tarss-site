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
