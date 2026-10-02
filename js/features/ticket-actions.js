/* ==========================================================================
   Tars · acciones del ticket: PDF y pago online
   --------------------------------------------------------------------------
   Se carga después de la registradora (main.js) y usa su API (getQuote /
   onChange). Todo lo pesado es diferido:
   - pdf.js + jsPDF (419 KB) se bajan recién al tocar «Descargar PDF».
   - El estado de los pagos (/api/payment-link) se consulta la primera vez
     que el ticket tiene algo, no al cargar la página.
   ========================================================================== */
import { showToast, setBusy } from '../lib/toast.js';
import { trackEvent } from '../lib/track.js';
import { quoteAnalytics } from '../lib/quote.js';

export function initTicketActions(register) {
  const pdfButton = document.querySelector('#ticket-pdf');
  const payButton = document.querySelector('#ticket-pay');
  if (!register || (!pdfButton && !payButton)) return;

  // El bloque arranca oculto en el HTML: recién ahora (con JS listo) se muestra.
  const container = document.querySelector('#ticket-actions');
  if (container) container.hidden = false;

  let paymentsChecked = false;

  function sync(quote) {
    if (pdfButton) pdfButton.disabled = quote.isEmpty || pdfButton.classList.contains('is-busy');
    if (payButton && !payButton.hidden && !payButton.classList.contains('is-busy')) {
      // Solo se cobra online lo de pago único.
      payButton.disabled = quote.oneTime === 0;
      payButton.title = quote.oneTime === 0 ? 'Los servicios mensuales se coordinan por WhatsApp' : '';
    }
    if (!quote.isEmpty && !paymentsChecked && payButton) {
      paymentsChecked = true;
      import('../lib/payments.js')
        .then((m) => m.getPaymentStatus())
        .then(({ enabled }) => {
          payButton.hidden = !enabled;
          sync(register.getQuote());
        });
    }
  }

  pdfButton?.addEventListener('click', async () => {
    const quote = register.getQuote();
    if (quote.isEmpty) return;
    setBusy(pdfButton, true, 'Imprimiendo PDF...');
    try {
      const { downloadDocument } = await import('../lib/pdf.js');
      const model = await downloadDocument('presupuesto', quote);
      showToast(`Presupuesto ${model.reference} descargado.`, { type: 'success' });
      trackEvent('quote_pdf_download', quoteAnalytics(quote));
    } catch (error) {
      console.error(error);
      showToast('No se pudo generar el PDF. Probá de nuevo.', { type: 'error' });
    } finally {
      setBusy(pdfButton, false);
      sync(register.getQuote());
    }
  });

  payButton?.addEventListener('click', async () => {
    const quote = register.getQuote();
    if (quote.oneTime === 0) return;
    setBusy(payButton, true, 'Generando link...');
    try {
      const { requestPaymentLink } = await import('../lib/payments.js');
      const link = await requestPaymentLink(quote);
      trackEvent('begin_checkout', quoteAnalytics(quote));
      if (link.mock) {
        showToast('Modo de prueba: el link es simulado, no se cobra nada.', { type: 'info' });
      }
      window.location.assign(link.checkout_url);
    } catch (error) {
      showToast(error.message, { type: 'error' });
      setBusy(payButton, false);
      sync(register.getQuote());
    }
  });

  register.onChange(sync);
  sync(register.getQuote());
}
