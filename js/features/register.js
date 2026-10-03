/* Tars · registradora (index y servicios)
   Se carga solo en páginas con #ticket-form (import dinámico desde main.js). */

import { WHATSAPP_NUMBER, prefersReducedMotion } from '../lib/env.js';
import { createQuote, priceLabel, buildWhatsAppUrl, quoteAnalytics } from '../lib/quote.js?v=20261003b';
import { trackEvent } from '../lib/track.js';

/* --- 6. Registradora ------------------------------------------------------
   Contador mecánico: cada dígito es una «rueda» con los números 0-9 en
   columna; para mostrar el 7 se corre la columna 7em hacia arriba. El CSS
   anima ese corrimiento con un resorte y lo escalona de derecha a izquierda. */
const ODOMETER_DIGITS = 4;

function buildOdometer(element) {
  element.textContent = '';
  const prefix = document.createElement('span');
  prefix.className = 'odo-prefix';
  prefix.textContent = 'USD';
  element.appendChild(prefix);

  const wheels = [];
  for (let position = 0; position < ODOMETER_DIGITS; position += 1) {
    const digit = document.createElement('span');
    digit.className = 'odo-digit';
    const strip = document.createElement('span');
    strip.className = 'odo-strip';
    // --i: 0 en las unidades (gira primero), 3 en los miles (gira último).
    strip.style.setProperty('--i', String(ODOMETER_DIGITS - 1 - position));
    for (let n = 0; n <= 9; n += 1) {
      const cell = document.createElement('span');
      cell.textContent = String(n);
      strip.appendChild(cell);
    }
    digit.appendChild(strip);
    element.appendChild(digit);
    wheels.push({ digit, strip });
  }
  return wheels;
}

function setOdometer(wheels, amount) {
  const text = String(Math.min(amount, 10 ** ODOMETER_DIGITS - 1)).padStart(ODOMETER_DIGITS, '0');
  const firstSignificant = text.search(/[1-9]/);
  wheels.forEach(({ digit, strip }, position) => {
    strip.style.setProperty('--d', text[position]);
    // Ceros a la izquierda en gris, como en una registradora.
    const isLead = firstSignificant === -1 ? position < ODOMETER_DIGITS - 1 : position < firstSignificant;
    digit.classList.toggle('is-lead', isLead);
  });
}

export function initRegister() {
  const form = document.querySelector('#ticket-form');
  if (!form) return null;

  const ticket = document.querySelector('#ticket');
  const lines = document.querySelector('#ticket-lines');
  const live = document.querySelector('#ticket-live');
  const request = document.querySelector('#ticket-request');
  const hint = document.querySelector('#ticket-hint');
  const stub = document.querySelector('#ticket-stub');
  const stubTotal = document.querySelector('#ticket-stub-total');
  const dateEl = document.querySelector('#ticket-date');
  const odoOnce = buildOdometer(document.querySelector('[data-odometer="once"]'));
  const odoMonthly = buildOdometer(document.querySelector('[data-odometer="monthly"]'));

  if (dateEl) {
    const today = new Date();
    dateEl.dateTime = today.toISOString().slice(0, 10);
    dateEl.textContent = today.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  // Estado: el presupuesto actual (inmutable, viene de quote.js). Las demás
  // funciones lo leen en vez de volver a recorrer el formulario.
  let quote = createQuote();
  let registerVisible = false;
  const listeners = new Set();

  const selectedIds = () => Array.from(form.querySelectorAll('input[name="service"]:checked'), (input) => input.dataset.service);

  function updateStub() {
    if (!stub) return;
    stub.classList.toggle('is-shown', !quote.isEmpty && !registerVisible);
  }

  // Renglones: se diffea contra lo ya impreso. Solo se crean los nuevos (y
  // solo esos «se imprimen» con animación); los que se desmarcan se quitan.
  function renderLines(previous, animate) {
    const before = new Set(previous.items.map((item) => item.id));
    const now = new Set(quote.items.map((item) => item.id));

    lines.querySelector('.ticket-empty')?.remove();
    lines.querySelectorAll('li[data-id]').forEach((li) => { if (!now.has(li.dataset.id)) li.remove(); });

    quote.items.forEach((item, index) => {
      let li = lines.querySelector(`li[data-id="${item.id}"]`);
      if (!li) {
        li = document.createElement('li');
        li.dataset.id = item.id;
        if (animate && !before.has(item.id)) li.className = 'ticket-line';
        const name = document.createElement('span');
        name.textContent = item.name;
        const price = document.createElement('span');
        price.textContent = priceLabel(item);
        li.append(name, price);
      }
      // Mantiene el orden del catálogo aunque se marquen en otro orden.
      if (lines.children[index] !== li) lines.insertBefore(li, lines.children[index] || null);
    });

    if (quote.isEmpty) {
      const empty = document.createElement('li');
      empty.className = 'ticket-empty';
      empty.textContent = 'Todavía no marcaste nada.';
      lines.appendChild(empty);
    }
  }

  function render(animate) {
    const previous = quote;
    quote = createQuote(selectedIds());

    renderLines(previous, animate);
    // El contador solo se toca si cambió el importe (evita reiniciar el giro).
    if (quote.oneTime !== previous.oneTime || !animate) setOdometer(odoOnce, quote.oneTime);
    if (quote.monthly !== previous.monthly || !animate) setOdometer(odoMonthly, quote.monthly);
    live.textContent = `Total: ${quote.totalText}`;
    if (stubTotal) stubTotal.textContent = quote.totalText;

    if (quote.isEmpty) {
      request.setAttribute('aria-disabled', 'true');
      request.removeAttribute('href');
      hint.textContent = 'Elegí al menos un servicio.';
    } else {
      const plural = quote.count > 1 ? 's' : '';
      request.removeAttribute('aria-disabled');
      request.href = buildWhatsAppUrl(quote, WHATSAPP_NUMBER);
      hint.textContent = `${quote.count} servicio${plural} en el ticket.`;
    }

    if (animate && !prefersReducedMotion) {
      // Reinicia la animación de «avance de papel».
      ticket.classList.remove('is-feeding');
      void ticket.offsetWidth;
      ticket.classList.add('is-feeding');
    }
    updateStub();
    listeners.forEach((listener) => listener(quote));
  }

  // Talón: aparece cuando hay algo en el ticket y el cotizador no está a la vista.
  if (stub) {
    stub.hidden = false; // la visibilidad la maneja .is-shown (CSS)
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        registerVisible = entries[0].isIntersecting;
        updateStub();
      }, { threshold: 0.15 }).observe(document.querySelector('#cotizador'));
    }
  }

  // Teclas con data-group (tipo de web, plan del asistente): una por grupo.
  // Al prender una, se apagan las otras del mismo grupo antes de recalcular.
  form.addEventListener('change', (event) => {
    const key = event.target;
    if (key.checked && key.dataset.group) {
      form.querySelectorAll(`input[data-group="${key.dataset.group}"]`).forEach((other) => {
        if (other !== key) other.checked = false;
      });
    }
    render(true);
  });
  form.addEventListener('submit', (event) => event.preventDefault());

  request.addEventListener('click', (event) => {
    if (request.getAttribute('aria-disabled') === 'true') {
      event.preventDefault();
      return;
    }
    trackEvent('quote_request', quoteAnalytics(quote));
  });

  render(false); // estado inicial (el navegador puede recordar teclas marcadas)

  // API para otras funciones de la registradora (PDF, cobros): leen el
  // presupuesto actual y se enteran de los cambios sin tocar el formulario.
  return {
    getQuote: () => quote,
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
