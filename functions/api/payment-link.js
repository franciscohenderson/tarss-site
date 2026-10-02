/* ==========================================================================
   /api/payment-link · Cloudflare Pages Function
   --------------------------------------------------------------------------
   GET  -> { enabled, mode }       ¿se muestra el botón «Pagar»? (no expone claves)
   POST { services: ["landing", ...], buyer?: { name, email } }
        -> { id, checkout_url, mock, mode, amount }

   Seguridad:
   - El importe se recalcula en el servidor con el catálogo de quote.js a
     partir de los ids: el navegador no puede mandar su propio precio.
   - Se valida tamaño y forma del pedido; los errores de Nave no exponen
     detalles internos ni credenciales.
   - Solo se cobra lo de pago único (los mensuales se coordinan aparte).

   Variables de entorno (Cloudflare Pages > Settings > Environment variables):
     NAVE_ENABLED=true          muestra el botón en el sitio
     NAVE_ENV=sandbox|production
     NAVE_CLIENT_ID, NAVE_CLIENT_SECRET, NAVE_AUDIENCE, NAVE_POS_ID  (secretos)
     NAVE_CURRENCY=ARS|USD      moneda en la que cobra Nave (por defecto ARS)
     NAVE_USD_ARS_RATE=...      cotización de RESPALDO USD -> ARS (si DolarAPI falla)
     NAVE_RATE_SOURCE=mep|oficial  cotización en vivo de DolarAPI (por defecto mep)
     NAVE_LIVE_RATE=false       opcional: usar solo la cotización fija
     NAVE_NOTIFICATION_URL=...  opcional: webhook de avisos de pago
   Sin credenciales, el modo es «mock»: devuelve un link simulado.
   ========================================================================== */

import { createQuote } from '../../js/lib/quote.js';
import { naveConfig, createPaymentLink, NaveError } from '../_lib/nave.js';

const MAX_BODY = 4096;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

export function onRequestGet({ env }) {
  const config = naveConfig(env);
  return json({ enabled: config.enabled, mode: config.mode });
}

export async function onRequestPost({ request, env }, fetchImpl = fetch) {
  const config = naveConfig(env);
  if (!config.enabled) return json({ error: 'Los pagos online no están habilitados.' }, 404);

  // --- Validación del pedido ---
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ error: 'Pedido demasiado grande.' }, 413);
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: 'El pedido no es JSON válido.' }, 400);
  }
  const services = Array.isArray(body?.services) ? body.services.filter((s) => typeof s === 'string').slice(0, 10) : [];
  const quote = createQuote(services);
  if (quote.isEmpty) return json({ error: 'Elegí al menos un servicio.' }, 400);
  if (quote.oneTime === 0) {
    return json({ error: 'Los servicios mensuales se coordinan aparte: escribime por WhatsApp.' }, 422);
  }

  const buyer = {};
  if (typeof body.buyer?.name === 'string' && body.buyer.name.trim()) buyer.name = body.buyer.name.trim().slice(0, 100);
  if (typeof body.buyer?.email === 'string' && body.buyer.email.trim()) {
    if (!EMAIL.test(body.buyer.email.trim())) return json({ error: 'El email no es válido.' }, 400);
    buyer.email = body.buyer.email.trim();
  }

  const reference = `tars-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
  const siteUrl = new URL(request.url).origin;

  // --- Modo simulado: no hay credenciales, no se cobra nada ---
  if (config.mode === 'mock') {
    return json({
      id: `mock_${reference}`,
      checkout_url: `${siteUrl}/gracias.html?pago=simulado&ref=${encodeURIComponent(reference)}`,
      mock: true,
      mode: 'mock',
      amount: { currency: 'USD', value: quote.oneTime },
    });
  }

  // --- Nave real (sandbox o producción) ---
  try {
    const link = await createPaymentLink(config, quote, { reference, buyer, siteUrl }, fetchImpl);
    return json({
      id: link.id,
      checkout_url: link.checkoutUrl,
      mock: false,
      mode: config.mode,
      amount: { currency: 'USD', value: quote.oneTime },
      exchange: link.exchange, // { rate, source }: qué cotización se usó
    });
  } catch (error) {
    const status = error instanceof NaveError ? error.status : 500;
    // Al log del servidor va el detalle; al navegador, un mensaje genérico.
    console.error('[payment-link]', error.message);
    return json({ error: 'No se pudo generar el link de pago. Probá de nuevo o escribime por WhatsApp.' }, status);
  }
}
