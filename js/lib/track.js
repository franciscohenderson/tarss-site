/* Tars · medición para Google Tag Manager
   Mismos eventos de siempre: whatsapp_click, email_click, quote_request, generate_lead. */

export function trackEvent(event, params = {}) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...params });
}

export function initLinkTracking() {
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href');
    // El botón del ticket manda su propio evento (quote_request).
    if (href.includes('wa.me/') && !link.matches('#ticket-request')) {
      trackEvent('whatsapp_click', { link_text: link.textContent.trim().slice(0, 60), page_path: location.pathname });
    } else if (href.startsWith('mailto:')) {
      trackEvent('email_click', { page_path: location.pathname });
    }
  });
}
