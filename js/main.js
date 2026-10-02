/* ==========================================================================
   Tars — «Imprenta Riso» · punto de entrada
   --------------------------------------------------------------------------
   Code splitting sin build: los módulos ES se cargan nativos en el navegador.
   - Núcleo (todas las páginas): medición, tema, menú, motor de desregistro,
     botones magnéticos, vigía del hero.
   - Funciones por página (import dinámico, solo si su HTML existe):
       #ticket-form     -> features/register.js      (index, servicios)
                           + features/ticket-actions.js (PDF y pago)
       #contact-form    -> features/contact-form.js  (contacto)
       .runaway-button  -> features/runaway.js       (404)
   Así la 404 o el blog no descargan el cotizador ni el formulario.
   - Core Web Vitals (lib/vitals.js): después de load, en un momento ocioso.
   ========================================================================== */
import { initLinkTracking } from './lib/track.js';
import { initThemeToggle, initNavigation, initRisoEngine, initMagnetic, initHeroWatch } from './core.js';

initLinkTracking();
initThemeToggle();
initNavigation();
initRisoEngine();
initMagnetic();
initHeroWatch();

/* El formulario se carga diferido, pero si alguien lo envía antes de que
   llegue el módulo (conexión lenta), el envío no puede salir por la vía
   clásica: se retiene, se espera al módulo y se reenvía. */
function loadContactForm() {
  const form = document.querySelector('#contact-form');
  let ready = false;
  const early = (event) => {
    if (ready) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    loading.then(() => form.requestSubmit());
  };
  form.addEventListener('submit', early, true);
  const loading = import('./features/contact-form.js').then((m) => {
    m.initContactForm();
    ready = true;
    form.removeEventListener('submit', early, true);
  });
  return loading;
}

const features = [
  ['#ticket-form', async () => {
    const register = (await import('./features/register.js')).initRegister();
    // PDF y pago online: después de la registradora, usando su API.
    (await import('./features/ticket-actions.js')).initTicketActions(register);
  }],
  ['#contact-form', loadContactForm],
  ['.runaway-button', () => import('./features/runaway.js').then((m) => m.initRunawayButton())],
];

for (const [selector, load] of features) {
  if (document.querySelector(selector)) {
    load().catch((error) => console.error(`No se pudo cargar ${selector}:`, error));
  }
}

/* Core Web Vitals (todas las páginas): después del evento load y en un
   momento ocioso, así la medición nunca compite con lo que ve la persona.
   web-vitals recupera lo que pasó antes (buffered), no se pierde nada. */
function loadWebVitals() {
  const start = () => import('./lib/vitals.js')
    .then((m) => m.initWebVitals())
    .catch((error) => console.error('No se pudo cargar web-vitals:', error));
  if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 4000 });
  else setTimeout(start, 1500);
}

if (document.readyState === 'complete') loadWebVitals();
else addEventListener('load', loadWebVitals, { once: true });
