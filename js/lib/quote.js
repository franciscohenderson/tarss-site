/* ==========================================================================
   Tars 2.0 · lógica del presupuesto (módulo puro: sin DOM)
   --------------------------------------------------------------------------
   Única fuente de verdad de precios y cálculos. La usan:
   - el navegador (registradora, PDF),
   - los tests (tests/quote.spec.js),
   - el servidor de cobros (functions/api/payment-link.js): el importe se
     recalcula ACÁ a partir de los ids, nunca se confía en el precio que
     manda el navegador.
   Para cambiar un precio o sumar un servicio: editar CATALOG y la tecla
   correspondiente en index.html / servicios.html (data-service="id").
   ========================================================================== */

export const CATALOG = Object.freeze({
  landing: Object.freeze({ id: 'landing', name: 'Landing Page', price: 149, billing: 'once' }),
  mantenimiento: Object.freeze({ id: 'mantenimiento', name: 'Mantenimiento', price: 50, billing: 'monthly' }),
  'seo-local': Object.freeze({ id: 'seo-local', name: 'SEO Local', price: 80, billing: 'once' }),
});

export function formatUSD(amount) {
  return `USD ${amount.toLocaleString('es-AR')}`;
}

/* Precio de un renglón: «USD 149» o «USD 50/mes». */
export function priceLabel(item) {
  return `${formatUSD(item.price)}${item.billing === 'monthly' ? '/mes' : ''}`;
}

/* Un pago único y una cuota mensual no se suman en un solo número
   (USD 149 + USD 50/mes NO son «USD 199»): se muestran por separado. */
export function describeTotal(oneTime, monthly) {
  if (oneTime && monthly) return `${formatUSD(oneTime)} + ${formatUSD(monthly)}/mes`;
  if (monthly) return `${formatUSD(monthly)}/mes`;
  return formatUSD(oneTime);
}

/* createQuote(['landing', 'mantenimiento']) -> presupuesto inmutable.
   Ignora ids desconocidos y repetidos; respeta el orden del catálogo. */
export function createQuote(ids = []) {
  const wanted = new Set(ids);
  const items = Object.values(CATALOG).filter((item) => wanted.has(item.id));
  const oneTime = items.filter((i) => i.billing !== 'monthly').reduce((sum, i) => sum + i.price, 0);
  const monthly = items.filter((i) => i.billing === 'monthly').reduce((sum, i) => sum + i.price, 0);
  return Object.freeze({
    items,
    oneTime,
    monthly,
    count: items.length,
    isEmpty: items.length === 0,
    totalText: describeTotal(oneTime, monthly),
  });
}

export function buildWhatsAppMessage(quote) {
  return [
    '¡Hola! Quiero solicitar este presupuesto de Tars 2.0:',
    '',
    ...quote.items.map((item) => `• ${item.name}: ${priceLabel(item)}`),
    '',
    `Total estimado: ${quote.totalText}`,
  ].join('\n');
}

export function buildWhatsAppUrl(quote, phone) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(buildWhatsAppMessage(quote))}`;
}

/* Parámetros del evento quote_request para GTM (value = pagos únicos;
   el mensual va aparte para no mezclar importes de distinta naturaleza). */
export function quoteAnalytics(quote) {
  return {
    currency: 'USD',
    value: quote.oneTime,
    monthly_value: quote.monthly,
    services: quote.items.map((item) => item.name).join(', '),
  };
}
