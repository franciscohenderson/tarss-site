/* ==========================================================================
   Tars 2.0 · cliente de la API de Nave (Galicia) para links de cobro
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

const REQUIRED = ['NAVE_CLIENT_ID', 'NAVE_CLIENT_SECRET', 'NAVE_AUDIENCE', 'NAVE_POS_ID'];

/* Lee la configuración del entorno y decide el modo. */
export function naveConfig(env = {}) {
  const missing = REQUIRED.filter((key) => !env[key]);
  const target = env.NAVE_ENV === 'production' ? 'production' : 'sandbox';
  const currency = (env.NAVE_CURRENCY || 'ARS').toUpperCase();
  const rate = Number(env.NAVE_USD_ARS_RATE);
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
    // Los precios del sitio están en USD. Si Nave cobra en pesos, hace falta
    // la cotización a usar (la define el negocio, no el código).
    usdToCurrency: currency === 'USD' ? 1 : (Number.isFinite(rate) && rate > 0 ? rate : null),
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
export function buildPaymentRequest(config, quote, { reference, buyer, siteUrl }) {
  if (config.usdToCurrency === null) {
    throw new NaveError('Falta NAVE_USD_ARS_RATE: los precios están en USD y Nave cobra en ' + config.currency + '.', 500);
  }
  const convert = (usd) => Math.round(usd * config.usdToCurrency * 100) / 100;
  const items = quote.items.filter((item) => item.billing !== 'monthly');
  const total = items.reduce((sum, item) => sum + convert(item.price), 0);

  const body = {
    external_payment_id: reference,
    seller: { pos_id: config.posId },
    transactions: [{
      amount: { currency: config.currency, value: money(total) },
      products: items.map((item) => ({
        name: item.name,
        description: `Servicio Tars 2.0: ${item.name}`,
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

/* Crea el link de cobro. Devuelve { id, checkoutUrl, status }. */
export async function createPaymentLink(config, quote, options, fetchImpl = fetch) {
  const token = await getAccessToken(config, fetchImpl);
  const response = await fetchImpl(`${config.urls.api}/payment_request/ecommerce`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(buildPaymentRequest(config, quote, options)),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.checkout_url) {
    throw new NaveError(`Nave no pudo crear el cobro (HTTP ${response.status}).`, 502);
  }
  return { id: data.id ?? null, checkoutUrl: data.checkout_url, status: data.status?.name ?? null };
}
