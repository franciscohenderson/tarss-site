/* Tars · formulario de contacto (contacto.html)
   Se carga solo si existe #contact-form. */

import { trackEvent } from '../lib/track.js';
import { showToast, setBusy } from '../lib/toast.js';

/* --- 8. Formulario de contacto (contacto.html) -----------------------------
   Se envía a Formspree por detrás (fetch) y se avisa con un toast. Sin JS,
   el formulario se envía de la forma clásica y Formspree redirige a gracias
   (campo oculto _next). gracias.html es la que cuenta la conversión. */
export function initContactForm() {
  const form = document.querySelector('#contact-form');
  if (!form) return;
  const submit = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setBusy(submit, true, 'Enviando...'); // también evita el doble envío
    const sending = showToast('Enviando tu mensaje...', { type: 'info', duration: 0 });
    let redirecting = false;

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' }, // Formspree responde JSON
      });
      sending.hide();

      if (response.ok) {
        showToast('¡Mensaje enviado! Te llevo a la confirmación...', { type: 'success' });
        form.reset();
        trackEvent('generate_lead', { form_id: 'contacto', page_path: location.pathname });
        redirecting = true;
        setTimeout(() => { window.location.href = 'gracias.html'; }, 2000);
      } else {
        const data = await response.json().catch(() => null);
        showToast(data?.error || 'Hubo un problema al enviar. Probá de nuevo.', { type: 'error' });
      }
    } catch (error) {
      sending.hide();
      showToast('No se pudo enviar. Revisá tu conexión e intentá de nuevo.', { type: 'error' });
    } finally {
      if (!redirecting) setBusy(submit, false);
      else if (submit) submit.disabled = true; // nos vamos a gracias.html
    }
  });
}

