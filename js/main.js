/* ==========================================================================
   Tars 2.0 — «Imprenta Riso» · punto de entrada
   --------------------------------------------------------------------------
   Code splitting sin build: los módulos ES se cargan nativos en el navegador.
   - Núcleo (todas las páginas): medición, tema, menú, motor de desregistro,
     botones magnéticos, vigía del hero.
   - Funciones por página (import dinámico, solo si su HTML existe):
       #ticket-form     -> features/register.js      (index, servicios)
       #contact-form    -> features/contact-form.js  (contacto)
       .runaway-button  -> features/runaway.js       (404)
   Así la 404 o el blog no descargan el cotizador ni el formulario.
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
  ['#ticket-form', () => import('./features/register.js').then((m) => m.initRegister())],
  ['#contact-form', loadContactForm],
  ['.runaway-button', () => import('./features/runaway.js').then((m) => m.initRunawayButton())],
];

for (const [selector, load] of features) {
  if (document.querySelector(selector)) {
    load().catch((error) => console.error(`No se pudo cargar ${selector}:`, error));
  }
}
