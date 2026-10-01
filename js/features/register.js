/* Tars 2.0 · registradora (index y servicios)
   Se carga solo en páginas con #ticket-form (import dinámico desde main.js). */

import { WHATSAPP_NUMBER, prefersReducedMotion, formatUSD } from '../lib/env.js';
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
  if (!form) return;

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

  const selected = () => Array.from(form.querySelectorAll('input[name="service"]:checked')).map((input) => ({
    name: input.value,
    price: Number(input.dataset.price) || 0,
    monthly: input.dataset.billing === 'monthly',
  }));

  // Un pago único y una cuota mensual no se suman en un solo número.
  const describe = (oneTime, monthly) => {
    if (oneTime && monthly) return `${formatUSD(oneTime)} + ${formatUSD(monthly)}/mes`;
    if (monthly) return `${formatUSD(monthly)}/mes`;
    return formatUSD(oneTime);
  };

  let printed = new Set();
  let total = { oneTime: 0, monthly: 0 };
  let registerVisible = false;

  function updateStub() {
    if (!stub) return;
    const hasItems = total.oneTime > 0 || total.monthly > 0;
    stub.classList.toggle('is-shown', hasItems && !registerVisible);
  }

  function render(animate) {
    const services = selected();
    const oneTime = services.filter((s) => !s.monthly).reduce((sum, s) => sum + s.price, 0);
    const monthly = services.filter((s) => s.monthly).reduce((sum, s) => sum + s.price, 0);
    total = { oneTime, monthly };
    const totalText = describe(oneTime, monthly);

    // Renglones: solo los que se agregan ahora «se imprimen» (animación).
    lines.textContent = '';
    if (services.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'ticket-empty';
      empty.textContent = 'Todavía no marcaste nada.';
      lines.appendChild(empty);
    }
    const nowPrinted = new Set();
    services.forEach((service) => {
      const li = document.createElement('li');
      if (animate && !printed.has(service.name)) li.className = 'ticket-line';
      const name = document.createElement('span');
      name.textContent = service.name;
      const price = document.createElement('span');
      price.textContent = `${formatUSD(service.price)}${service.monthly ? '/mes' : ''}`;
      li.append(name, price);
      lines.appendChild(li);
      nowPrinted.add(service.name);
    });
    printed = nowPrinted;

    setOdometer(odoOnce, oneTime);
    setOdometer(odoMonthly, monthly);
    live.textContent = `Total: ${totalText}`;
    if (stubTotal) stubTotal.textContent = totalText;

    if (services.length === 0) {
      request.setAttribute('aria-disabled', 'true');
      request.removeAttribute('href');
      hint.textContent = 'Elegí al menos un servicio.';
    } else {
      const plural = services.length > 1 ? 's' : '';
      const message = [
        '¡Hola! Quiero solicitar este presupuesto de Tars 2.0:',
        '',
        ...services.map((s) => `• ${s.name}: ${formatUSD(s.price)}${s.monthly ? '/mes' : ''}`),
        '',
        `Total estimado: ${totalText}`,
      ].join('\n');
      request.removeAttribute('aria-disabled');
      request.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
      hint.textContent = `${services.length} servicio${plural} en el ticket.`;
    }

    if (animate && !prefersReducedMotion) {
      // Reinicia la animación de «avance de papel».
      ticket.classList.remove('is-feeding');
      void ticket.offsetWidth;
      ticket.classList.add('is-feeding');
    }
    updateStub();
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

  form.addEventListener('change', () => render(true));
  form.addEventListener('submit', (event) => event.preventDefault());

  request.addEventListener('click', (event) => {
    if (request.getAttribute('aria-disabled') === 'true') {
      event.preventDefault();
      return;
    }
    trackEvent('quote_request', {
      currency: 'USD',
      value: total.oneTime,
      monthly_value: total.monthly,
      services: selected().map((s) => s.name).join(', '),
    });
  });

  render(false); // estado inicial (el navegador puede recordar teclas marcadas)
}

