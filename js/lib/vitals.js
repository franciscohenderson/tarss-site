/* Tars 2.0 · Core Web Vitals reales -> dataLayer (GTM / GA4)
   --------------------------------------------------------------------------
   Mide LCP, CLS e INP en las visitas reales con web-vitals (Google, Apache
   2.0, vendor/web-vitals/). Se usa el build «attribution» porque además dice
   QUÉ elemento causó el problema (debug_target): sin eso el número no sirve
   para arreglar nada.

   Lo carga main.js recién cuando la página terminó de cargar y el navegador
   está ocioso: web-vitals lee las mediciones con `buffered: true`, así que no
   pierde lo que pasó antes y no compite con el render inicial.

   Cada métrica llega UNA vez por página (cuando su valor es definitivo,
   normalmente al ocultar o cerrar la pestaña) como este evento:

     {
       event: 'web_vitals',
       metric_name: 'LCP' | 'CLS' | 'INP',
       metric_value: 1234,          // ms (LCP, INP) · sin unidad, 4 decimales (CLS)
       metric_rating: 'good' | 'needs-improvement' | 'poor',
       metric_id: 'v5-1727...',     // único por métrica y carga de página
       navigation_type: 'navigate' | 'reload' | 'back-forward' | ...,
       debug_target: 'main>section.hero>h1',   // elemento responsable
       page_path: '/servicios',
     }

   Todas las claves van siempre (vacías si no aplican) para que el modelo de
   datos de GTM no arrastre valores de una métrica a la siguiente. */
import { onCLS, onINP, onLCP } from '../../vendor/web-vitals/web-vitals.attribution.js';
import { trackEvent } from './track.js';

const TARGET = {
  LCP: (a) => a.target,
  CLS: (a) => a.largestShiftTarget,
  INP: (a) => a.interactionTarget,
};

const round = (name, value) => (name === 'CLS' ? Math.round(value * 10000) / 10000 : Math.round(value));

export function vitalsPayload({ name, value, rating, id, navigationType, attribution = {} }) {
  return {
    metric_name: name,
    metric_value: round(name, value),
    metric_rating: rating,
    metric_id: id,
    navigation_type: navigationType || '',
    debug_target: (TARGET[name]?.(attribution) || '').slice(0, 100),
    page_path: location.pathname,
  };
}

const send = (metric) => trackEvent('web_vitals', vitalsPayload(metric));

export function initWebVitals() {
  onLCP(send);
  onCLS(send);
  onINP(send);
}
