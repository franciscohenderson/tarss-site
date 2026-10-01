/* ==========================================================================
   Tars 2.0 — «Imprenta Riso» (comportamiento de todo el sitio)
   --------------------------------------------------------------------------
   Módulos (cada init revisa si su parte existe en la página):
   1. Medición para Google Tag Manager (mismos eventos que antes).
   2. Tema claro/oscuro.
   3. Menú (margen de impresión) + sección activa.
   4. Motor de scroll: desregistro riso, cinta y afiches. Un solo rAF.
   5. Botones magnéticos con resorte (solo mouse).
   6. Registradora: ticket, contador mecánico y talón flotante.
   7-8. Avisos (toasts) y formulario de contacto por fetch (contacto.html).
   9. Easter egg del botón que se escapa (404.html).
   ========================================================================== */

const WHATSAPP_NUMBER = '5492617459362';
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function formatUSD(amount) {
  return `USD ${amount.toLocaleString('es-AR')}`;
}

/* Resorte amortiguado «a mano»: cada cuadro acerca `value` a `target` con una
   fuerza proporcional a la distancia (stiffness) y frena con la velocidad
   (damping). Con damping < 2·√stiffness rebota un poco antes de asentarse. */
function createSpring({ stiffness = 170, damping = 18 } = {}) {
  return { value: 0, velocity: 0, target: 0, stiffness, damping };
}

function stepSpring(spring, dt) {
  const force = (spring.target - spring.value) * spring.stiffness;
  spring.velocity += (force - spring.velocity * spring.damping) * dt;
  spring.value += spring.velocity * dt;
  return Math.abs(spring.velocity) > 0.01 || Math.abs(spring.target - spring.value) > 0.01;
}

/* --- 1. Medición ---------------------------------------------------------- */
function trackEvent(event, params = {}) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...params });
}

function initLinkTracking() {
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

/* --- 2. Tema -------------------------------------------------------------- */
function initThemeToggle() {
  const root = document.documentElement;
  const current = () => (root.getAttribute('data-theme') === 'light' ? 'light' : 'dark');

  function apply(theme) {
    root.setAttribute('data-theme', theme);
    document.querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#141414' : '#f1ece2');
    document.querySelectorAll('.theme-toggle').forEach((button) => {
      const isDark = theme === 'dark';
      button.setAttribute('aria-label', isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
      button.setAttribute('title', isDark ? 'Modo claro' : 'Modo oscuro');
    });
  }

  apply(current());
  document.querySelectorAll('.theme-toggle').forEach((button) => {
    button.addEventListener('click', () => {
      const next = current() === 'dark' ? 'light' : 'dark';
      apply(next);
      try { localStorage.setItem('theme', next); } catch (error) { /* modo privado: no se recuerda */ }
    });
  });
}

/* --- 3. Menú -------------------------------------------------------------- */
function initNavigation() {
  const nav = document.querySelector('.margin');
  const toggle = nav?.querySelector('.nav-toggle');
  if (!nav || !toggle) return;

  const setOpen = (open) => {
    nav.classList.toggle('nav-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  };

  toggle.addEventListener('click', () => setOpen(!nav.classList.contains('nav-open')));
  nav.querySelectorAll('.margin-links a').forEach((link) => link.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && nav.classList.contains('nav-open')) {
      setOpen(false);
      toggle.focus();
    }
  });

  // Sección activa: el link de la sección que ocupa el centro de la pantalla
  // se pinta de rosa (como una marca de registro sobre el margen).
  const links = new Map();
  nav.querySelectorAll('.margin-links a[href^="#"]').forEach((link) => {
    const section = document.querySelector(link.getAttribute('href'));
    if (section) links.set(section, link);
  });
  if (!('IntersectionObserver' in window) || links.size === 0) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const link = links.get(entry.target);
      if (link) link.classList.toggle('is-active', entry.isIntersecting);
    });
  }, { rootMargin: '-50% 0px -50% 0px' });
  links.forEach((_, section) => observer.observe(section));
}

/* --- 4. Motor de scroll y desregistro -------------------------------------
   Todo lo que depende del scroll o del cursor se calcula en UN
   requestAnimationFrame (nunca en el evento directo): como mucho un cálculo
   por cuadro, y el bucle se duerme cuando el resorte se asienta. */
function initRisoEngine() {
  const root = document.documentElement;
  const tapeTrack = document.querySelector('.tape-track');
  const postersSection = document.querySelector('.posters');
  const posters = Array.from(document.querySelectorAll('.poster'));
  const sheets = posters.map((poster) => poster.querySelector('.poster-sheet'));

  // Desregistro: base fija de 3px/2px más lo que sume el cursor (o el scroll).
  const BASE_X = 3;
  const BASE_Y = 2;
  const MAX_X = 16;
  const MAX_Y = 10;
  const springX = createSpring({ stiffness: 120, damping: 14 });
  const springY = createSpring({ stiffness: 120, damping: 14 });

  if (prefersReducedMotion) {
    root.style.setProperty('--rx', `${BASE_X}px`);
    root.style.setProperty('--ry', `${BASE_Y}px`);
    return; // sin cinta móvil ni afiches que giran: todo quieto y legible
  }

  let lastScrollY = window.scrollY;
  let lastTime = performance.now();
  let frame = 0;
  let idleTimer = 0;
  let postersVisible = true;

  if ('IntersectionObserver' in window && postersSection) {
    new IntersectionObserver((entries) => {
      postersVisible = entries[0].isIntersecting;
      schedule();
    }).observe(postersSection);
  }

  function updatePosters() {
    if (posters.length === 0) return; // páginas sin afiches
    // Los afiches se fijan en «top» (0 en escritorio, 64px bajo la barra en
    // celular): el recorrido útil es desde el borde de abajo hasta ahí.
    const stick = parseFloat(getComputedStyle(posters[0]).top) || 0;
    const range = window.innerHeight - stick;
    posters.forEach((poster, index) => {
      const top = poster.getBoundingClientRect().top - stick;
      const enter = clamp(1 - top / range, 0, 1);
      const next = posters[index + 1];
      const cover = next ? clamp(1 - (next.getBoundingClientRect().top - stick) / range, 0, 1) : 0;
      sheets[index].style.setProperty('--enter', enter.toFixed(3));
      sheets[index].style.setProperty('--cover', cover.toFixed(3));
    });
  }

  function tick(now) {
    frame = 0;
    const dt = clamp((now - lastTime) / 1000, 1 / 240, 1 / 30);
    lastTime = now;

    // En pantallas táctiles no hay cursor: el desregistro sigue la velocidad
    // del scroll (al frenar, el resorte vuelve a registrar las tintas).
    const scrollY = window.scrollY;
    if (!hasFinePointer) {
      const velocity = (scrollY - lastScrollY) / dt;
      springY.target = clamp(velocity * 0.012, -MAX_Y, MAX_Y);
      springX.target = clamp(velocity * -0.008, -MAX_X, MAX_X);
    }
    lastScrollY = scrollY;

    const movingX = stepSpring(springX, dt);
    const movingY = stepSpring(springY, dt);
    root.style.setProperty('--rx', `${(BASE_X + springX.value).toFixed(2)}px`);
    root.style.setProperty('--ry', `${(BASE_Y + springY.value).toFixed(2)}px`);

    if (tapeTrack) {
      const half = tapeTrack.scrollWidth / 2;
      const x = half > 0 ? -((scrollY * 0.35) % half) : 0;
      tapeTrack.style.setProperty('--tape-x', `${x.toFixed(1)}px`);
    }

    if (postersVisible) updatePosters();

    if (movingX || movingY) schedule();
  }

  function schedule() {
    if (!frame) {
      lastTime = performance.now() - 16;
      frame = requestAnimationFrame(tick);
    }
  }

  window.addEventListener('scroll', () => {
    if (!hasFinePointer) {
      // Cuando el scroll se detiene, las tintas vuelven a registrar.
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        springX.target = 0;
        springY.target = 0;
        schedule();
      }, 120);
    }
    schedule();
  }, { passive: true });

  window.addEventListener('resize', schedule, { passive: true });

  if (hasFinePointer) {
    window.addEventListener('pointermove', (event) => {
      springX.target = ((event.clientX / window.innerWidth) - 0.5) * 2 * MAX_X;
      springY.target = ((event.clientY / window.innerHeight) - 0.5) * 2 * MAX_Y;
      schedule();
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => {
      springX.target = 0;
      springY.target = 0;
      schedule();
    });
  }

  updatePosters();
  schedule();
}

/* --- 5. Botones magnéticos ------------------------------------------------- */
function initMagnetic() {
  if (!hasFinePointer || prefersReducedMotion) return;

  document.querySelectorAll('[data-magnetic]').forEach((element) => {
    const sx = createSpring({ stiffness: 260, damping: 16 });
    const sy = createSpring({ stiffness: 260, damping: 16 });
    let frame = 0;
    let last = 0;

    const tick = (now) => {
      const dt = clamp((now - last) / 1000, 1 / 240, 1 / 30);
      last = now;
      const movingX = stepSpring(sx, dt);
      const movingY = stepSpring(sy, dt);
      element.style.setProperty('--mx', `${sx.value.toFixed(2)}px`);
      element.style.setProperty('--my', `${sy.value.toFixed(2)}px`);
      frame = movingX || movingY ? requestAnimationFrame(tick) : 0;
    };
    const start = () => {
      if (!frame) {
        last = performance.now() - 16;
        frame = requestAnimationFrame(tick);
      }
    };

    element.addEventListener('pointermove', (event) => {
      if (event.pointerType !== 'mouse') return;
      const rect = element.getBoundingClientRect();
      sx.target = clamp((event.clientX - (rect.left + rect.width / 2)) * 0.3, -10, 10);
      sy.target = clamp((event.clientY - (rect.top + rect.height / 2)) * 0.4, -8, 8);
      start();
    });
    element.addEventListener('pointerleave', () => {
      sx.target = 0;
      sy.target = 0;
      start();
    });
  });
}

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

function initRegister() {
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

/* --- 7. Avisos (toasts) ----------------------------------------------------
   Arriba al centro; la región es role="status" para que los lectores de
   pantalla lean el mensaje. textContent (nunca innerHTML): un error que venga
   del servidor no puede inyectar HTML. */
function getToastRegion() {
  let region = document.querySelector('.toast-region');
  if (!region) {
    region = document.createElement('div');
    region.className = 'toast-region';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    document.body.appendChild(region);
  }
  return region;
}

function showToast(message, { type = 'info', duration = 4000 } = {}) {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  const icon = document.createElement('span');
  icon.className = 'toast-icon';
  icon.setAttribute('aria-hidden', 'true');
  const text = document.createElement('span');
  text.textContent = message;
  toast.append(icon, text);
  getToastRegion().appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('is-visible'));

  let hideTimer = 0;
  const hide = () => {
    clearTimeout(hideTimer);
    toast.classList.remove('is-visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    setTimeout(() => toast.remove(), 600); // respaldo si no hay transición
  };
  if (duration > 0) hideTimer = setTimeout(hide, duration);
  return { hide };
}

/* --- 8. Formulario de contacto (contacto.html) -----------------------------
   Se envía a Formspree por detrás (fetch) y se avisa con un toast. Sin JS,
   el formulario se envía de la forma clásica y Formspree redirige a gracias
   (campo oculto _next). gracias.html es la que cuenta la conversión. */
function initContactForm() {
  const form = document.querySelector('#contact-form');
  if (!form) return;
  const submit = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submit) submit.disabled = true; // evita doble envío
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
      if (submit && !redirecting) submit.disabled = false;
    }
  });
}

/* --- 9. Easter egg de la 404 -----------------------------------------------
   Con MOUSE, «Volver al inicio» se escapa 4 veces y después se deja
   clickear. Con dedo o teclado funciona normal (un botón que se mueve al
   tocarlo sería imposible de usar). Con «reducir movimiento», no se mueve. */
function initRunawayButton() {
  const button = document.querySelector('.runaway-button');
  if (!button) return;

  const area = button.closest('.page-hero') || document.body;
  const message = document.querySelector('.runaway-message');
  const MAX_ESCAPES = 4;
  const MIN_DISTANCE = 160;
  const EDGE = 16;
  const taunts = [
    'Uy, casi 😏',
    '¿Seguro que querés volver? 🙃',
    'Un intento más...',
    'Bueno, está bien, me rindo. Hacé clic 😅',
  ];
  let escapes = 0;
  let offsetX = 0;
  let offsetY = 0;

  button.style.transition = 'transform 450ms cubic-bezier(0.34, 1.56, 0.64, 1)';

  button.addEventListener('pointerenter', (event) => {
    if (event.pointerType !== 'mouse' || escapes >= MAX_ESCAPES || prefersReducedMotion) return;

    const areaRect = area.getBoundingClientRect();
    const rect = button.getBoundingClientRect();
    const baseLeft = rect.left - offsetX;
    const baseTop = rect.top - offsetY;
    const minX = areaRect.left + EDGE - baseLeft;
    const maxX = areaRect.right - EDGE - rect.width - baseLeft;
    const minY = areaRect.top + EDGE - baseTop;
    const maxY = areaRect.bottom - EDGE - rect.height - baseTop;

    // Varios lugares al azar: el primero lejos del cursor (o el más lejano).
    let best = { x: offsetX, y: offsetY, distance: -1 };
    for (let i = 0; i < 20; i += 1) {
      const x = minX + Math.random() * Math.max(0, maxX - minX);
      const y = minY + Math.random() * Math.max(0, maxY - minY);
      const distance = Math.hypot(baseLeft + x + rect.width / 2 - event.clientX, baseTop + y + rect.height / 2 - event.clientY);
      if (distance > best.distance) best = { x, y, distance };
      if (distance >= MIN_DISTANCE) break;
    }

    offsetX = best.x;
    offsetY = best.y;
    button.style.transform = `translate(${offsetX}px, ${offsetY}px) rotate(${(Math.random() * 8 - 4).toFixed(1)}deg)`;
    if (message) message.textContent = taunts[escapes] || '';
    escapes += 1;
  });

  // Si cambia la ventana, los límites cambian: vuelve a su lugar.
  window.addEventListener('resize', () => {
    offsetX = 0;
    offsetY = 0;
    button.style.transform = '';
  });
}

/* Mientras se ve el hero, el sello flotante de WhatsApp se esconde: el
   hero ya tiene su propio botón de WhatsApp y se pisarían. */
function initHeroWatch() {
  const hero = document.querySelector(".hero");
  if (!hero || !("IntersectionObserver" in window)) return;
  new IntersectionObserver((entries) => {
    document.body.classList.toggle("hero-in-view", entries[0].isIntersecting);
  }, { threshold: 0.35 }).observe(hero);
}

/* --- Arranque ------------------------------------------------------------- */
initLinkTracking();
initThemeToggle();
initNavigation();
initRisoEngine();
initMagnetic();
initRegister();
initHeroWatch();
initContactForm();
initRunawayButton();
