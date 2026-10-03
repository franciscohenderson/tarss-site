/* Tars · prueba de imprenta (index)
   La persona escribe el nombre de su negocio y elige el rubro; la hoja se
   «imprime» con su nombre y un celular con una pantalla de muestra de ese
   rubro. Escribir actualiza al instante (sin animación: es una acción
   repetida); cambiar de rubro pasa el rodillo. */

import { WHATSAPP_NUMBER, prefersReducedMotion } from '../lib/env.js';
import { trackEvent } from '../lib/track.js';

const IMG = 'img/prueba/';
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (text) => text.replace(/[&<>"']/g, (char) => ESCAPES[char]);
// Iniciales para el logo: solo palabras que empiezan con letra o número («Brasa & Vid» -> BV).
const initials = (name) => name.split(/\s+/).filter((word) => /^[\p{L}\p{N}]/u.test(word)).slice(0, 2).map((word) => word[0]).join('').toUpperCase();

const svg = (path) => `<svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
const ICON = {
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  heart: svg('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.600-7 10-7 10z"/>'),
  share: svg('<path d="M12 15V4M8 8l4-4 4 4M5 13v6h14v-6"/>'),
  bag: svg('<path d="M6 8h12l1 12H5zM9 8V6a3 3 0 0 1 6 0v2"/>'),
  truck: svg('<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="17.500" r="1.500"/><circle cx="17.500" cy="17.500" r="1.500"/>'),
  calendar: svg('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/>'),
  pin: svg('<path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.800 7 11 7 11z"/><circle cx="12" cy="10" r="2.500"/>'),
  ticket: svg('<path d="M4 9a2 2 0 0 0 0 6v3h16v-3a2 2 0 0 0 0-6V6H4zM10 6v12"/>'),
  chat: svg('<path d="M5 5h14v10H10l-5 4z"/>'),
};
// QR de muestra: tres marcas de esquina y módulos con un patrón fijo (no aleatorio, sale siempre igual).
const QR = (() => {
  const finder = (x, y) => `<rect x="${x}" y="${y}" width="7" height="7"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="#f2f2f2"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3"/>`;
  const reserved = (x, y) => (x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12);
  let seed = 11, cells = '';
  const next = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let y = 0; y < 21; y++) for (let x = 0; x < 21; x++) if (!reserved(x, y) && next() < 0.5) cells += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
  return `<svg class="pf-qr" viewBox="-1 -1 23 23" aria-hidden="true"><rect x="-1" y="-1" width="23" height="23" fill="#f2f2f2" stroke="none"/><g fill="#090909" stroke="none">${finder(0, 0)}${finder(14, 0)}${finder(0, 14)}${cells}</g></svg>`;
})();
const top = (right) => `<div class="pf-top"><span class="pf-rb">${ICON.back}</span><div>${right.map((icon) => `<span class="pf-rb">${icon}</span>`).join('')}</div></div>`;

/* Cada rubro: nombre de ejemplo, frase de la hoja y la pantalla del celular
   (formato de las apps que la gente ya usa en ese rubro). */
export const KINDS = {
  restaurante: {
    sample: 'Brasa & Vid',
    line: 'Tu carta siempre al día',
    feats: 'Carta digital · Reservas · Pedidos por WhatsApp',
    screen: (name) => `<div class="pf-hero"><img src="${IMG}brasa.webp" alt="" width="312" height="176">${top([ICON.heart, ICON.share])}</div>
      <div class="pf-sheet">
        <div class="pf-row"><div><b class="pf-name">${name}</b><small>Parrilla · Cocina a leña · $$</small></div><span class="pf-logo">${esc(initials(name))}</span></div>
        <div class="pf-meta"><span><i>★</i> 4,8</span><span>30–45 min</span><span>Envío $ 1.200</span></div>
        <div class="pf-seg"><span class="on">Delivery</span><span>Retiro</span><span>Reservar mesa</span></div>
        <div class="pf-tabs"><span class="on">Más pedidos</span><span>Parrilla</span><span>Pastas</span><span>Vinos</span></div>
        <div class="pf-item"><div><b>Ojo de bife a la leña</b><small>400 g, con papas rotas</small><em>$ 24.500</em></div><span class="pf-ph"><img src="${IMG}plato-1.webp" alt="" width="66" height="66"><i>+</i></span></div>
        <div class="pf-item"><div><b>Lomo al malbec</b><small>Con frutos rojos</small><em>$ 26.400</em></div><span class="pf-ph"><img src="${IMG}plato-2.webp" alt="" width="66" height="66"><i>+</i></span></div>
        <div class="pf-item"><div><b>Entraña con remolacha</b><small>Hojas verdes</small><em>$ 22.900</em></div><span class="pf-ph"><img src="${IMG}plato-3.webp" alt="" width="66" height="66"><i>+</i></span></div>
      </div>
      <div class="pf-bar"><span class="pf-n">2</span>Ver pedido<b>$ 49.000</b></div>`,
  },
  ropa: {
    sample: 'Lana Cruda',
    line: 'Tu tienda abierta 24 horas',
    feats: 'Catálogo con talles · Cuotas · Envíos',
    screen: (name) => `<div class="pf-hero"><img src="${IMG}tapado.webp" alt="" width="312" height="282">${top([ICON.share, ICON.bag])}<span class="pf-off">20% OFF</span></div>
      <div class="pf-info">
        <div class="pf-brand">${name}</div><div class="pf-title">Tapado Aura de paño</div>
        <div class="pf-rate"><i>★★★★★</i> 4,9 · 212 opiniones</div>
        <div class="pf-price"><b>$ 128.000</b><s>$ 160.000</s><em>20% OFF</em></div>
        <div class="pf-fee">3 cuotas sin interés de $ 42.666</div>
        <div class="pf-label">Color: <span>Camel</span></div>
        <div class="pf-colors"><i class="on c1"></i><i class="c2"></i><i class="c3"></i><i class="c4"></i></div>
        <div class="pf-label">Talle</div>
        <div class="pf-sizes"><span>S</span><span class="on">M</span><span>L</span><span class="no">XL</span></div>
        <div class="pf-ship">${ICON.truck}<div><b>Envío gratis</b> · llega el jueves</div></div>
      </div>
      <div class="pf-buy"><span>${ICON.heart}</span><b>Agregar al carrito</b></div>`,
  },
  barberia: {
    sample: 'Filo Norte',
    line: 'Turnos sin hacer fila',
    feats: 'Reserva online · Elección de barbero · Recordatorio',
    screen: (name) => `<div class="pf-hero"><img src="${IMG}barberia.webp" alt="" width="312" height="172">${top([ICON.heart, ICON.share])}</div>
      <div class="pf-sheet">
        <b class="pf-name">${name}</b>
        <div class="pf-stars"><i>★</i> <b>4,9</b> (328 reseñas) · Godoy Cruz</div>
        <div class="pf-open">Abierto <span>· cierra a las 21:00</span></div>
        <div class="pf-tabs"><span class="on">Servicios</span><span>Equipo</span><span>Reseñas</span><span>Info</span></div>
        <div class="pf-serv"><div><b>Corte clásico</b><small>30 min · <em>$ 9.000</em></small></div><span>Reservar</span></div>
        <div class="pf-serv"><div><b>Corte + barba</b><small>45 min · <em>$ 13.500</em></small></div><span class="on">Elegido</span></div>
        <div class="pf-serv"><div><b>Afeitado a navaja</b><small>30 min · <em>$ 8.000</em></small></div><span>Reservar</span></div>
        <div class="pf-serv"><div><b>Color y mechas</b><small>60 min · <em>$ 18.000</em></small></div><span>Reservar</span></div>
      </div>
      <div class="pf-bar"><div><b>Corte + barba · $ 13.500</b><small>Mar 7 · 16:45 con Mateo</small></div><em>Continuar</em></div>`,
  },
  gimnasio: {
    sample: 'Pulso',
    line: 'Tu gym en el bolsillo',
    feats: 'Carnet con QR · Reserva de clases · Beneficios',
    screen: (name) => `<div class="pf-pad">
        <div class="pf-row"><b class="pf-name">${name}</b><span class="pf-rb">${ICON.chat}</span></div>
        <div class="pf-hi"><small>Buen día,</small>Hola, Mateo</div>
        <div class="pf-card"><div><small>CARNET DIGITAL</small><b>Mateo<br>Ríos</b><span>PLAN FULL · ACTIVO</span></div>${QR}</div>
        <div class="pf-acts"><div>${ICON.calendar}Clases</div><div>${ICON.pin}Sedes</div><div>${ICON.ticket}Beneficios</div></div>
        <div class="pf-cap">TU PRÓXIMA CLASE</div>
        <div class="pf-next"><b>19:00</b><div>Funcional<small>Hoy · Sede Centro</small></div><span>Reservada</span></div>
        <div class="pf-next"><b>20%</b><div>Tienda de suplementos<small>Socios · hasta el 31/10</small></div></div>
      </div>`,
  },
  otro: {
    sample: 'Tu negocio',
    line: 'Tus clientes te encuentran y te escriben',
    feats: 'Servicios claros · WhatsApp · Aparecés en Google',
    screen: (name) => `<div class="pf-pad">
        <div class="pf-row"><b class="pf-name">${name}</b><span class="pf-rb">${ICON.chat}</span></div>
        <div class="pf-claim">Hacemos bien lo nuestro.<br>Escribinos hoy.</div>
        <div class="pf-cta">Pedir presupuesto por WhatsApp</div>
        <div class="pf-cap">SERVICIOS</div>
        <div class="pf-next"><b>01</b><div>Lo que más te piden<small>Con precio a la vista</small></div></div>
        <div class="pf-next"><b>02</b><div>Tu segundo servicio<small>Explicado en una línea</small></div></div>
        <div class="pf-next"><b>03</b><div>Zona y horarios<small>Cómo llegar · Lunes a sábado</small></div></div>
        <div class="pf-stars"><i>★★★★★</i> Opiniones de tus clientes</div>
      </div>`,
  },
};

export function initProof() {
  const form = document.querySelector('#proof-form');
  const sheet = document.querySelector('.proof-sheet');
  if (!form || !sheet) return;

  const input = form.querySelector('#proof-name');
  const request = form.querySelector('#proof-request');
  const print = sheet.querySelector('.proof-print');
  const roller = sheet.querySelector('.proof-roller');
  const nameEl = sheet.querySelector('.proof-name');
  const lineEl = sheet.querySelector('.proof-line');
  const featsEl = sheet.querySelector('.proof-feats');
  const phone = sheet.querySelector('.proof-phone');
  const screen = sheet.querySelector('.proof-screen');
  const status = document.querySelector('#proof-status');
  const heroLead = document.querySelector('.hero-lead');
  const heroLeadText = heroLead?.textContent;

  const state = { name: '', kind: form.elements.rubro.value || 'restaurante' };
  let tracked = false;

  function render() {
    const kind = KINDS[state.kind];
    const typed = state.name.trim();
    const name = typed || kind.sample;

    nameEl.textContent = name;
    nameEl.dataset.text = name;
    // Nombres largos achican la letra para que sigan entrando en la hoja.
    nameEl.style.setProperty('--fit', Math.min(1, 9 / name.length).toFixed(3));
    lineEl.textContent = kind.line;
    featsEl.textContent = kind.feats;
    screen.dataset.kind = state.kind;
    screen.innerHTML = kind.screen(esc(name));

    const rubro = state.kind === 'otro' ? '' : ` (${form.querySelector('input[name="rubro"]:checked + span').textContent.toLowerCase()})`;
    const message = typed
      ? `Hola Tars, vi la prueba de imprenta y quiero una web para ${typed}${rubro}.`
      : `Hola Tars, vi la prueba de imprenta y quiero una web para mi negocio${rubro}.`;
    request.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    request.textContent = typed ? `Quiero la web de ${typed}` : 'Quiero esta web';

    if (heroLead) heroLead.textContent = typed.length >= 2 ? `Ayudo a ${typed} a` : heroLeadText;
    if (status) status.textContent = `Prueba de muestra para ${name}: ${kind.line.toLowerCase()}.`;
  }

  /* Pasada de rodillo: la hoja queda en blanco y el contenido aparece detrás
     del rodillo, de izquierda a derecha. Después las tintas del nombre entran
     en registro. */
  function pass() {
    if (prefersReducedMotion || !print.animate) return;
    const width = sheet.offsetWidth;
    const timing = { duration: 560, easing: 'cubic-bezier(0.77, 0, 0.175, 1)' };
    print.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], timing);
    roller.animate([
      { transform: 'translateX(0)', opacity: 1 },
      { transform: `translateX(${width + roller.offsetWidth}px)`, opacity: 1 },
    ], timing);
    nameEl.classList.remove('is-registering');
    void nameEl.offsetWidth; // reinicia la animación de registro
    nameEl.classList.add('is-registering');
  }

  function touched() {
    if (tracked) return;
    tracked = true;
    trackEvent('proof_preview', { kind: state.kind });
  }

  input.addEventListener('input', () => {
    state.name = input.value;
    render();
    touched();
  });
  form.addEventListener('change', (event) => {
    if (event.target.name !== 'rubro') return;
    state.kind = event.target.value;
    render();
    pass();
    touched();
  });
  form.addEventListener('submit', (event) => event.preventDefault());

  // La pantalla está dibujada a 312 px de ancho y se escala al celular.
  const fit = () => phone.style.setProperty('--s', (phone.clientWidth / 312).toFixed(4));
  if ('ResizeObserver' in window) new ResizeObserver(fit).observe(phone);
  fit();

  /* La pantalla (y sus imágenes) se arma recién cuando la sección está por
     entrar; la primera pasada de rodillo ocurre cuando ya se ve. */
  if (!('IntersectionObserver' in window)) { render(); return; }
  const near = new IntersectionObserver((entries) => {
    if (!entries[0].isIntersecting) return;
    near.disconnect();
    render();
  }, { rootMargin: '600px 0px' });
  near.observe(sheet);
  const seen = new IntersectionObserver((entries) => {
    if (!entries[0].isIntersecting) return;
    seen.disconnect();
    pass();
  }, { threshold: 0.35 });
  seen.observe(sheet);
}
