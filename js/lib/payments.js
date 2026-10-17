/* Tars · cliente de /api/payment-link (Cloudflare Pages Function)
   El navegador solo manda los ids de los servicios: el importe lo calcula el
   servidor con el catálogo. Sin la función (ej. http-server local) o con
   NAVE_ENABLED distinto de "true", el botón de pago no aparece. */

const ENDPOINT = '/api/payment-link';

let statusPromise = null;

/* ¿Están habilitados los pagos online? Se consulta una vez por página, pero
   solo se recuerda una respuesta definitiva (200 o «no hay función»): un corte de
   red o un 5xx devuelve { enabled: false, retry: true } y NO se cachea, así «Pagar»
   no queda apagado toda la sesión por un fallo pasajero. */
export function getPaymentStatus() {
  if (!statusPromise) {
    statusPromise = fetch(ENDPOINT, { headers: { Accept: 'application/json' } })
      .then((response) => {
        if (response.status >= 500) throw new Error(`HTTP ${response.status}`);
        return response.ok ? response.json() : { enabled: false };
      })
      .then((data) => ({ enabled: data?.enabled === true, mode: data?.mode ?? 'off' }))
      .catch(() => { statusPromise = null; return { enabled: false, mode: 'off', retry: true }; });
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
