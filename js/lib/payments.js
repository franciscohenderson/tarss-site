/* Tars 2.0 · cliente de /api/payment-link (Cloudflare Pages Function)
   El navegador solo manda los ids de los servicios: el importe lo calcula el
   servidor con el catálogo. Sin la función (ej. http-server local) o con
   NAVE_ENABLED distinto de "true", el botón de pago no aparece. */

const ENDPOINT = '/api/payment-link';

let statusPromise = null;

/* ¿Están habilitados los pagos online? Se consulta una vez por página. */
export function getPaymentStatus() {
  if (!statusPromise) {
    statusPromise = fetch(ENDPOINT, { headers: { Accept: 'application/json' } })
      .then((response) => (response.ok ? response.json() : { enabled: false }))
      .then((data) => ({ enabled: data?.enabled === true, mode: data?.mode ?? 'off' }))
      .catch(() => ({ enabled: false, mode: 'off' }));
  }
  return statusPromise;
}

/* Pide el link de cobro. Devuelve { id, checkout_url, mock, mode, amount }
   o lanza un Error con un mensaje para mostrarle a la persona. */
export async function requestPaymentLink(quote, buyer) {
  let response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ services: quote.items.map((item) => item.id), ...(buyer ? { buyer } : {}) }),
    });
  } catch {
    throw new Error('No hay conexión. Revisá internet e intentá de nuevo.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.checkout_url) {
    throw new Error(data?.error || 'No se pudo generar el link de pago.');
  }
  return data;
}
