/* ==========================================================================
   Tars · cliente de la API de Nave (Galicia) para links de cobro
   --------------------------------------------------------------------------
   Corre SOLO del lado del servidor (Cloudflare Pages Functions): las claves
   viven en variables de entorno y nunca llegan al navegador.

   Endpoints y cuerpo tomados del plugin oficial «nave-for-woocommerce»
   (src/Api/TokenManager.php y src/Api/NaveApiClient.php). Antes de cobrar
   en producción, confirmarlos con la documentación que entrega Nave al
   habilitar la integración (https://navenegocios.ar/home/developers).

   Modos:
   - «mock»: faltan credenciales -> devuelve un link simulado (no cobra).
   - «sandbox» / «production»: según NAVE_ENV, con credenciales completas.
   ========================================================================== */

export const NAVE_URLS = {
  sandbox: {
    token: 'https://homoservices.apinaranja.com/security-ms/api/security/auth0/b2b/m2ms',
    api: 'https://api-sandbox.ranty.io/api',
  },
  production: {
    token: 'https://services.apinaranja.com/security-ms/api/security/auth0/b2b/m2msPrivate',
    api: 'https://api.ranty.io/api',
  },
};

/* --- Cotización USD -> ARS (estrategia híbrida) ---------------------------
   1) DolarAPI en vivo (https://dolarapi.com), valor «venta»: lo que le cuesta
      al cliente comprar esos dólares. Fuente configurable: mep (por defecto,
      endpoint «bolsa» de DolarAPI) u oficial.
   2) Si falla, tarda más de 2.5 s, devuelve algo inválido o un valor fuera
      de rango (menos de 1/3 o más de 3 veces la cotización de respaldo,
      para frenar datos rotos sin descartar cotizaciones reales cuando el
      respaldo quedó viejo por la inflación): NAVE_USD_ARS_RATE.
   La cotización en vivo se cachea 10 minutos por instancia: no se consulta
   DolarAPI en cada cobro. Un error de DolarAPI nunca cancela el cobro si
   hay cotización de respaldo. */
export const RATE_SOURCES = ['mep', 'oficial'];
// En DolarAPI el dólar MEP se publica como «bolsa» (/v1/dolares/mep da 404).
const DOLARAPI_PATHS = { mep: 'bolsa', oficial: 'oficial' };
export const dolarApiUrl = (source) => `https://dolarapi.com/v1/dolares/${DOLARAPI_PATHS[source] ?? source}`;
const RATE_TIMEOUT_MS = 2500;
const RATE_CACHE_MS = 10 * 60 * 1000;
const RATE_MAX_FACTOR = 3; // rango aceptado: respaldo/3 .. respaldo*3
const rateCache = new Map();

export function clearRateCache() {
  rateCache.clear();
}

async function fetchLiveRate(source, fetchImpl, timeoutMs) {
  const controller = new AbortController();
  let timer;
  // Carrera contra un temporizador propio: corta aunque el servidor (o un
  // fetch de prueba) ignore la señal de cancelación.
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => { controller.abort(); resolve(null); }, timeoutMs);
  });
  const request = (async () => {
    const response = await fetchImpl(dolarApiUrl(source), { headers: { Accept: 'application/json' }, signal: controller.signal });
    if (!response.ok) return null;
    const data = await response.json();
    const venta = Number(data?.venta);
    return Number.isFinite(venta) && venta > 0 ? venta : null;
  })().catch(() => null); // red caída, JSON roto, cancelación: todo es «sin dato»
  try {
    return await Promise.race([request, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/* Devuelve { rate, source } (source: «dolarapi-mep», «dolarapi-oficial»,
   «env» o «none» si se cobra en USD). Solo lanza si no hay NINGUNA
   cotización posible (DolarAPI caída y sin NAVE_USD_ARS_RATE). */
export async function getExchangeRate(config, { fetchImpl = fetch, timeoutMs = RATE_TIMEOUT_MS, now = Date.now } = {}) {
  if (config.currency === 'USD') return { rate: 1, source: 'none' };

  if (config.liveRate) {
    const key = config.rateSource;
    const cached = rateCache.get(key);
    if (cached && cached.expiresAt > now()) return { rate: cached.rate, source: `dolarapi-${key}` };

    const live = await fetchLiveRate(key, fetchImpl, timeoutMs);
    const fallback = config.fallbackRate;
    const plausible = live !== null && (fallback === null || (live >= fallback / RATE_MAX_FACTOR && live <= fallback * RATE_MAX_FACTOR));
    if (plausible) {
      rateCache.set(key, { rate: live, expiresAt: now() + RATE_CACHE_MS });
      return { rate: live, source: `dolarapi-${key}` };
    }
    if (live !== null) console.warn(`[cotizacion] DolarAPI dio ${live}, lejos del respaldo ${fallback}: se usa el respaldo.`);
  }

  if (config.fallbackRate !== null) return { rate: config.fallbackRate, source: 'env' };
  throw new NaveError('Sin cotización: DolarAPI no respondió y falta NAVE_USD_ARS_RATE.', 500);
}

const REQUIRED = ['NAVE_CLIENT_ID', 'NAVE_CLIENT_SECRET', 'NAVE_AUDIENCE', 'NAVE_POS_ID'];

/* Lee la configuración del entorno y decide el modo. */
export function naveConfig(env = {}) {
  const missing = REQUIRED.filter((key) => !env[key]);
  const target = env.NAVE_ENV === 'production' ? 'production' : 'sandbox';
  const currency = (env.NAVE_CURRENCY || 'ARS').toUpperCase();
  const rate = Number(env.NAVE_USD_ARS_RATE);
  const source = (env.NAVE_RATE_SOURCE || 'mep').toLowerCase();
  return {
    mode: missing.length ? 'mock' : target,
    missing,
    enabled: env.NAVE_ENABLED === 'true', // el botón «Pagar» solo aparece si esto es true
    urls: NAVE_URLS[target],
    clientId: env.NAVE_CLIENT_ID,
    clientSecret: env.NAVE_CLIENT_SECRET,
    audience: env.NAVE_AUDIENCE,
    posId: env.NAVE_POS_ID,
    currency,
    // Los precios del sitio están en USD. Si Nave cobra en pesos, la
    // cotización sale de DolarAPI en vivo y, si falla, de NAVE_USD_ARS_RATE
    // (ver getExchangeRate). Con NAVE_LIVE_RATE=false se usa solo la fija.
    fallbackRate: currency === 'USD' ? 1 : (Number.isFinite(rate) && rate > 0 ? rate : null),
    rateSource: RATE_SOURCES.includes(source) ? source : 'mep',
    liveRate: currency !== 'USD' && env.NAVE_LIVE_RATE !== 'false',
    notificationUrl: env.NAVE_NOTIFICATION_URL || null,
  };
}

/* Token OAuth máquina a máquina, cacheado hasta un minuto antes de vencer
   (un token por instancia del worker, no uno por cobro). */
const tokenCache = new Map();

export async function getAccessToken(config, fetchImpl = fetch, now = Date.now) {
  const key = `${config.urls.token}|${config.clientId}`;
  const cached = tokenCache.get(key);
  if (cached && cached.expiresAt > now()) return cached.token;

  const response = await fetchImpl(config.urls.token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: config.clientId, client_secret: config.clientSecret, audience: config.audience }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw new NaveError(`Nave rechazó la autenticación (HTTP ${response.status}).`, 502);
  }
  const ttl = Math.max(60, Number(data.expires_in) || 3600);
  tokenCache.set(key, { token: data.access_token, expiresAt: now() + (ttl - 60) * 1000 });
  return data.access_token;
}

export function clearTokenCache() {
  tokenCache.clear();
}

export class NaveError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = 'NaveError';
    this.status = status;
  }
}

const money = (value) => value.toFixed(2);

/* Cuerpo del «payment request» (estructura del plugin oficial). Solo se
   cobra lo de pago único: los servicios mensuales se coordinan aparte. */
export function buildPaymentRequest(config, quote, { reference, buyer, siteUrl, rate }) {
  if (!(Number.isFinite(rate) && rate > 0)) {
    throw new NaveError(`Cotización inválida para cobrar en ${config.currency}.`, 500);
  }
  const convert = (usd) => Math.round(usd * rate * 100) / 100;
  const items = quote.items.filter((item) => item.billing !== 'monthly');
  const total = items.reduce((sum, item) => sum + convert(item.price), 0);

  const body = {
    external_payment_id: reference,
    seller: { pos_id: config.posId },
    transactions: [{
      amount: { currency: config.currency, value: money(total) },
      products: items.map((item) => ({
        name: item.name,
        description: `Servicio Tars: ${item.name}`,
        quantity: 1,
        unit_price: { currency: config.currency, value: money(convert(item.price)) },
      })),
    }],
    additional_info: {
      callback_url: `${siteUrl}/gracias.html`,
      ...(config.notificationUrl ? { notification_url: config.notificationUrl } : {}),
    },
  };
  if (buyer?.name || buyer?.email) {
    body.buyer = {
      ...(buyer.name ? { name: buyer.name } : {}),
      ...(buyer.email ? { user_email: buyer.email } : {}),
    };
  }
  return body;
}

/* Crea el link de cobro. Devuelve { id, checkoutUrl, status, exchange }.
   La cotización se resuelve primero (nunca lanza si hay respaldo). */
export async function createPaymentLink(config, quote, options, fetchImpl = fetch) {
  const exchange = await getExchangeRate(config, { fetchImpl });
  const token = await getAccessToken(config, fetchImpl);
  const response = await fetchImpl(`${config.urls.api}/payment_request/ecommerce`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(buildPaymentRequest(config, quote, { ...options, rate: exchange.rate })),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.checkout_url) {
    throw new NaveError(`Nave no pudo crear el cobro (HTTP ${response.status}).`, 502);
  }
  return { id: data.id ?? null, checkoutUrl: data.checkout_url, status: data.status?.name ?? null, exchange };
}
