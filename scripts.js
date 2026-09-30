/* ==========================================================================
   scripts.js -- Tars 2.0
   --------------------------------------------------------------------------
   Un solo archivo compartido por todas las páginas. Cada funcionalidad vive
   en su propia función `initAlgo()` y lo PRIMERO que hace es buscar sus
   elementos en el DOM: si la página actual no los tiene (ej. el cotizador
   solo existe en servicios.html), la función termina sin hacer nada. Así el
   mismo script sirve para todas las páginas sin romper ninguna.

   El <script> se carga con `defer`: el navegador lo descarga en paralelo
   pero lo ejecuta recién cuando terminó de leer TODO el HTML. Por eso acá
   podemos hacer querySelector sin esperar a DOMContentLoaded.
   ========================================================================== */

const WHATSAPP_NUMBER = '5492617459362';

/* Lo usan varios módulos: si la persona pidió "reducir movimiento" en su
   sistema operativo, apagamos las animaciones que no son esenciales. */
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* --------------------------------------------------------------------------
   Navegación (ya existía): scroll suave a anclas, menú hamburguesa y barra
   superior que cambia al bajar.
   -------------------------------------------------------------------------- */
function initNavigation() {
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const target = document.querySelector(link.getAttribute('href'));
      if (target) {
        event.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  const navToggle = document.querySelector('.nav-toggle');
  const navBar = navToggle?.closest('.topbar');

  if (navToggle) {
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.addEventListener('click', () => {
      const isOpen = navBar?.classList.toggle('nav-open');
      navToggle.setAttribute('aria-expanded', String(!!isOpen));
    });
  }

  document.querySelectorAll('.nav-links a').forEach((link) => {
    link.addEventListener('click', () => {
      if (navBar?.classList.contains('nav-open')) {
        navBar.classList.remove('nav-open');
        navToggle?.setAttribute('aria-expanded', 'false');
      }
    });
  });

  const topbar = document.querySelector('.topbar');
  if (topbar) {
    // { passive: true } le promete al navegador que no vamos a llamar
    // preventDefault() en el scroll: así puede scrollear sin esperarnos.
    window.addEventListener('scroll', () => {
      topbar.classList.toggle('scrolled', window.scrollY > 28);
    }, { passive: true });
  }
}

/* --------------------------------------------------------------------------
   3. Modo claro / oscuro
   --------------------------------------------------------------------------
   Cómo se decide el tema:
     1. Lo que la persona eligió a mano con el botón (guardado en localStorage,
        que persiste entre páginas y visitas del mismo sitio).
     2. Si nunca eligió: OSCURO, el diseño principal de la marca. (A propósito
        no se usa prefers-color-scheme: la primera impresión es siempre la
        versión oscura.)

   El tema INICIAL no lo pone este archivo sino un <script> chiquito dentro
   del <head> de cada página. Motivo: este archivo corre al final (defer), y
   para entonces la página ya se pintó una vez; si el tema se aplicara recién
   acá, se vería un "destello" del tema equivocado. El script del <head> corre
   antes de pintar y solo pone data-theme en <html>. Acá se maneja el botón.
   -------------------------------------------------------------------------- */
const THEME_STORAGE_KEY = 'theme';

function getStoredTheme() {
  // localStorage puede lanzar error (modo privado de algunos navegadores,
  // cookies bloqueadas): en ese caso actuamos como si no hubiera nada guardado.
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

function storeTheme(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Sin localStorage el cambio funciona igual, solo que no se recuerda.
  }
}

function applyTheme(theme) {
  // Cambiar este atributo es todo lo que hace falta: en styles.css,
  // [data-theme="dark"] redefine las variables de color y cada regla que usa
  // var(--algo) se actualiza sola.
  document.documentElement.setAttribute('data-theme', theme);

  // Color de la barra del navegador en celulares.
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#07070d' : '#f5f7fc');

  // Actualizamos TODOS los botones de tema (hoy hay uno por página).
  document.querySelectorAll('.theme-toggle').forEach((button) => {
    const isDark = theme === 'dark';
    // El ícono muestra a qué modo VAS a pasar, y el aria-label lo dice en
    // palabras para lectores de pantalla (el emoji es solo decorativo).
    button.querySelector('span').textContent = isDark ? '☀️' : '🌙';
    button.setAttribute('aria-label', isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
    button.setAttribute('title', isDark ? 'Modo claro' : 'Modo oscuro');
  });
}

function initThemeToggle() {
  // Si por algún motivo el <head> no puso el atributo, vale el guardado o 'dark'.
  const currentTheme = () => document.documentElement.getAttribute('data-theme')
    || getStoredTheme() || 'dark';

  // Sincroniza ícono y etiqueta del botón con el tema que puso el <head>.
  applyTheme(currentTheme());

  document.querySelectorAll('.theme-toggle').forEach((button) => {
    button.addEventListener('click', () => {
      const next = currentTheme() === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      storeTheme(next); // se recuerda para las próximas páginas y visitas
    });
  });
}

/* --------------------------------------------------------------------------
   2. Efecto máquina de escribir (título de index.html)
   --------------------------------------------------------------------------
   HTML: <span class="typewriter" data-words='["vender más", ...]'>vender más</span>
   El span ya trae la primera palabra escrita en el HTML: si el JS no corre,
   el título igual tiene sentido (y es lo que indexa Google).

   Es una pequeña "máquina de estados" que se llama a sí misma con setTimeout:
     escribiendo -> (palabra completa) pausa larga -> borrando ->
     (palabra vacía) pausa corta -> siguiente palabra -> escribiendo ...
   Cada llamada agrega o quita UNA letra y programa la próxima.
   -------------------------------------------------------------------------- */
function initTypewriter() {
  const element = document.querySelector('.typewriter');
  if (!element) return;

  let words;
  try {
    words = JSON.parse(element.dataset.words); // data-words -> element.dataset.words
  } catch {
    return; // atributo mal formado: dejamos el texto fijo del HTML
  }
  if (!Array.isArray(words) || words.length === 0 || prefersReducedMotion) return;

  const TYPE_MS = 90;       // tiempo entre letras al escribir
  const DELETE_MS = 45;     // al borrar va más rápido
  const HOLD_MS = 1800;     // cuánto queda la palabra completa en pantalla
  const NEXT_MS = 400;      // pausa con el renglón vacío antes de la siguiente

  let wordIndex = 0;
  let charCount = Array.from(words[0]).length; // arranca con la 1ª palabra ya escrita
  let deleting = true;                          // ...así que lo primero es borrarla

  function tick() {
    // Array.from separa bien letras con tilde y emojis (un string.slice
    // podría cortar un emoji por la mitad).
    const letters = Array.from(words[wordIndex]);
    charCount += deleting ? -1 : 1;
    element.textContent = letters.slice(0, charCount).join('');

    let delay = deleting ? DELETE_MS : TYPE_MS;

    if (!deleting && charCount === letters.length) {
      // Terminó de escribir: dejamos la palabra un rato y empezamos a borrar.
      deleting = true;
      delay = HOLD_MS;
    } else if (deleting && charCount === 0) {
      // Terminó de borrar: pasamos a la siguiente palabra. El módulo (%)
      // hace que después de la última vuelva a la primera (ciclo infinito).
      deleting = false;
      wordIndex = (wordIndex + 1) % words.length;
      delay = NEXT_MS;
    }

    setTimeout(tick, delay);
  }

  // La primera palabra (la del HTML) se queda visible un rato antes de borrarse.
  setTimeout(tick, HOLD_MS);
}

/* --------------------------------------------------------------------------
   1. Cotizador en tiempo real (servicios.html)
   --------------------------------------------------------------------------
   HTML: cada servicio es un checkbox con data-price="149" y value="Landing Page".
   Los precios viven en el HTML, no acá: para cambiar un precio o agregar un
   servicio se edita solo servicios.html.

   Delegación de eventos: en vez de poner un listener en CADA checkbox,
   ponemos UNO en el <form>. El evento 'change' "burbujea" desde el checkbox
   que cambió hasta el form, así que un solo listener se entera de todos
   (y también de checkboxes que se agreguen después).
   -------------------------------------------------------------------------- */
function formatUSD(amount) {
  return `USD ${amount.toLocaleString('es-AR')}`;
}

function initQuoteCalculator() {
  const form = document.querySelector('#quote-form');
  if (!form) return;

  const totalOutput = form.querySelector('#quote-total');
  const requestButton = form.querySelector('#quote-request');
  const hint = form.querySelector('#quote-hint');

  function selectedServices() {
    // :checked filtra solo los marcados; Array.from convierte la NodeList
    // en un array para poder usar map/reduce.
    return Array.from(form.querySelectorAll('input[name="service"]:checked')).map((input) => ({
      name: input.value,
      price: Number(input.dataset.price) || 0,
      // data-billing="monthly" marca los servicios que se cobran todos los
      // meses (ej. Mantenimiento). Sin el atributo, es un pago único.
      monthly: input.dataset.billing === 'monthly',
    }));
  }

  // Un pago único y una cuota mensual no se pueden sumar en un solo número
  // (USD 149 + USD 50/mes NO son "USD 199"): se muestran por separado.
  function describeTotal(oneTime, monthly) {
    if (oneTime && monthly) return `${formatUSD(oneTime)} + ${formatUSD(monthly)}/mes`;
    if (monthly) return `${formatUSD(monthly)}/mes`;
    return formatUSD(oneTime);
  }

  function buildWhatsAppLink(services, totalText) {
    const lines = services.map((s) => `• ${s.name}: ${formatUSD(s.price)}${s.monthly ? '/mes' : ''}`);
    const message = [
      '¡Hola! Quiero solicitar este presupuesto de Tars 2.0:',
      '',
      ...lines,
      '',
      `Total estimado: ${totalText}`,
    ].join('\n');
    // encodeURIComponent convierte espacios, tildes, saltos de línea y
    // emojis a un formato válido dentro de una URL (ej. espacio -> %20).
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  }

  function update() {
    const services = selectedServices();
    // reduce "acumula": arranca en 0 y le suma el precio de cada servicio.
    // Se hace dos veces: una con los pagos únicos y otra con los mensuales.
    const oneTime = services.filter((s) => !s.monthly).reduce((sum, s) => sum + s.price, 0);
    const monthly = services.filter((s) => s.monthly).reduce((sum, s) => sum + s.price, 0);
    const totalText = describeTotal(oneTime, monthly);

    totalOutput.textContent = totalText;
    // Truco para re-disparar una animación CSS: sacar la clase, forzar al
    // navegador a recalcular el layout (leer offsetWidth) y volver a ponerla.
    totalOutput.classList.remove('bump');
    void totalOutput.offsetWidth;
    totalOutput.classList.add('bump');

    if (services.length === 0) {
      requestButton.setAttribute('aria-disabled', 'true');
      requestButton.removeAttribute('href');
      hint.textContent = 'Elegí al menos un servicio para armar tu presupuesto.';
    } else {
      const plural = services.length > 1 ? 's' : '';
      requestButton.removeAttribute('aria-disabled');
      requestButton.href = buildWhatsAppLink(services, totalText);
      hint.textContent = `${services.length} servicio${plural} seleccionado${plural}.`;
    }
  }

  form.addEventListener('change', update);

  // Un <a> sin href no navega, pero igual bloqueamos el clic por las dudas
  // (y el submit del form con Enter no tiene que recargar la página).
  requestButton.addEventListener('click', (event) => {
    if (requestButton.getAttribute('aria-disabled') === 'true') event.preventDefault();
  });
  form.addEventListener('submit', (event) => event.preventDefault());

  update(); // estado inicial (por si el navegador recordó checkboxes marcados)
}

/* --------------------------------------------------------------------------
   4. Easter egg de la 404: el botón que se escapa
   --------------------------------------------------------------------------
   Cuando el mouse ENTRA al botón (pointerenter), el botón salta a otro lugar
   de la tarjeta. Después de MAX_ESCAPES escapes se rinde y se deja clickear.

   - Solo huye del MOUSE (event.pointerType === 'mouse'). En celular no hay
     "hover": el dedo toca directo, y un botón que se mueve al tocarlo sería
     imposible de usar. Con teclado (Tab + Enter) tampoco se mueve.
   - Se mueve con transform: translate(x, y). No cambia el layout: el resto de
     la tarjeta no se reacomoda, y la transición CSS lo anima suave.
   -------------------------------------------------------------------------- */
function initRunawayButton() {
  const button = document.querySelector('.runaway-button');
  if (!button) return;

  const area = button.closest('.cta-box') || document.body; // límites del escape
  const message = document.querySelector('.runaway-message');
  const MAX_ESCAPES = 4;
  const MIN_DISTANCE = 140; // px: el nuevo lugar tiene que quedar lejos del cursor
  const EDGE = 16;          // margen para no pegarse al borde de la tarjeta

  const taunts = [
    'Uy, casi 😏',
    '¿Seguro que querés volver? 🙃',
    'Un intento más...',
    'Bueno, está bien, me rindo. Hacé clic 😅',
  ];

  let escapes = 0;
  let offsetX = 0; // desplazamiento actual aplicado con transform
  let offsetY = 0;

  button.addEventListener('pointerenter', (event) => {
    if (event.pointerType !== 'mouse' || escapes >= MAX_ESCAPES || prefersReducedMotion) return;

    // getBoundingClientRect() da la posición en pantalla YA desplazada; le
    // restamos el offset actual para saber dónde está el botón "de verdad".
    const areaRect = area.getBoundingClientRect();
    const btnRect = button.getBoundingClientRect();
    const baseLeft = btnRect.left - offsetX;
    const baseTop = btnRect.top - offsetY;

    // Rango de offsets posibles para que el botón quede DENTRO del área.
    const minX = areaRect.left + EDGE - baseLeft;
    const maxX = areaRect.right - EDGE - btnRect.width - baseLeft;
    const minY = areaRect.top + EDGE - baseTop;
    const maxY = areaRect.bottom - EDGE - btnRect.height - baseTop;

    // Probamos varios lugares al azar y nos quedamos con el primero que esté
    // lejos del cursor (o, si ninguno, con el más lejano que encontramos).
    let best = { x: offsetX, y: offsetY, distance: -1 };
    for (let i = 0; i < 20; i++) {
      const x = minX + Math.random() * Math.max(0, maxX - minX);
      const y = minY + Math.random() * Math.max(0, maxY - minY);
      const centerX = baseLeft + x + btnRect.width / 2;
      const centerY = baseTop + y + btnRect.height / 2;
      const distance = Math.hypot(centerX - event.clientX, centerY - event.clientY);
      if (distance > best.distance) best = { x, y, distance };
      if (distance >= MIN_DISTANCE) break;
    }

    offsetX = best.x;
    offsetY = best.y;
    button.style.transform = `translate(${offsetX}px, ${offsetY}px)`;

    if (message) message.textContent = taunts[escapes] || '';
    escapes += 1;
  });

  // Si cambia el tamaño de la ventana, los límites cambian: volvemos al lugar
  // original para que el botón nunca quede afuera de la tarjeta.
  window.addEventListener('resize', () => {
    offsetX = 0;
    offsetY = 0;
    button.style.transform = '';
  });
}

/* --------------------------------------------------------------------------
   5. Scroll reveal con IntersectionObserver (ya existía; mejorado)
   --------------------------------------------------------------------------
   IntersectionObserver le pide al navegador: "avisame cuando este elemento
   entre en pantalla". Es mucho más eficiente que escuchar el evento scroll y
   medir posiciones a mano en cada píxel de scroll.

   Mejoras respecto de la versión anterior:
   - Las tarjetas de una misma grilla aparecen escalonadas (--reveal-delay).
   - rootMargin con -8% abajo: el efecto arranca cuando el elemento ya entró
     un poco, no justo en el borde inferior (se ve más natural).
   - Con "reducir movimiento" activado no se oculta nada.
   -------------------------------------------------------------------------- */
function initScrollReveal() {
  if (prefersReducedMotion) return;

  const targets = document.querySelectorAll(
    'section, .card, .case-card, .cta-box, .hero h1, .hero-text, .hero-actions, .contact-form label, .quote-option'
  );

  targets.forEach((el) => {
    el.classList.add('reveal');
    // Si el elemento está dentro de una grilla, su posición entre sus
    // hermanos define el retraso: 0ms, 90ms, 180ms... (tope en 360ms).
    const parent = el.parentElement;
    if (parent && parent.matches('.grid, .faq-list, .quote-options, .contact-form')) {
      const index = Array.prototype.indexOf.call(parent.children, el);
      el.style.setProperty('--reveal-delay', `${Math.min(index, 4) * 90}ms`);
    }
  });

  if (!('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('reveal-active'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('reveal-active');
        // Ya apareció: dejamos de vigilarlo (el efecto ocurre una sola vez).
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

  targets.forEach((el) => observer.observe(el));
}

/* --------------------------------------------------------------------------
   Notificaciones toast
   --------------------------------------------------------------------------
   showToast('Texto', { type: 'success' | 'error' | 'info', duration: 4000 })

   - El contenedor (.toast-region) se crea la primera vez que hace falta y se
     reutiliza: cualquier página puede mostrar toasts sin tocar su HTML.
   - role="status" + aria-live="polite": los lectores de pantalla anuncian el
     mensaje sin interrumpir lo que la persona está haciendo.
   - Mostrar/ocultar = poner/sacar la clase .is-visible; la transición CSS
     hace la animación. Recién cuando TERMINA la transición de salida
     (evento 'transitionend') se borra el elemento del DOM.
   - duration: 0 = no se oculta solo (lo usamos para "Enviando..." y después
     lo cerramos a mano con el objeto que devuelve la función).
   -------------------------------------------------------------------------- */
const TOAST_ICONS = { success: '✅', error: '⚠️', info: '⏳' };

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

  // textContent (no innerHTML): el mensaje nunca se interpreta como HTML,
  // así un texto que venga de afuera (ej. un error del servidor) no puede
  // inyectar código en la página.
  const icon = document.createElement('span');
  icon.className = 'toast-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = TOAST_ICONS[type] || '';
  const text = document.createElement('span');
  text.textContent = message;
  toast.append(icon, text);

  getToastRegion().appendChild(toast);

  // requestAnimationFrame: esperamos a que el navegador pinte el toast en su
  // estado inicial (invisible) antes de agregar .is-visible. Si se agregara
  // en el mismo instante, no habría "antes" y la transición no se vería.
  requestAnimationFrame(() => toast.classList.add('is-visible'));

  let hideTimer = null;
  const hide = () => {
    clearTimeout(hideTimer);
    toast.classList.remove('is-visible');
    // { once: true } borra el listener después de ejecutarse una vez. El
    // setTimeout es un respaldo por si la transición no llega a dispararse
    // (ej. con "reducir movimiento" activado).
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    setTimeout(() => toast.remove(), 600);
  };

  if (duration > 0) hideTimer = setTimeout(hide, duration);
  return { hide };
}

/* --------------------------------------------------------------------------
   Formulario de contacto: envío a Formspree sin recargar la página.
   fetch() manda el formulario "por detrás" (AJAX) y, según la respuesta,
   mostramos un toast de éxito o de error. Sin JS, el formulario se envía de
   la forma clásica y Formspree redirige a /gracias (campo oculto _next).
   -------------------------------------------------------------------------- */
function initContactForm() {
  const contactForm = document.querySelector('#contact-form');
  if (!contactForm) return;

  const submitButton = contactForm.querySelector('button[type="submit"]');

  contactForm.addEventListener('submit', async (event) => {
    event.preventDefault(); // frena el envío clásico (que recargaría la página)
    if (submitButton) submitButton.disabled = true; // evita doble envío
    const sending = showToast('Enviando tu mensaje...', { type: 'info', duration: 0 });
    let redirecting = false;

    // FormData junta todos los campos del form (incluidos los ocultos).
    const formData = new FormData(contactForm);
    try {
      const response = await fetch(contactForm.action, {
        method: 'POST',
        body: formData,
        // Con este header Formspree responde JSON en vez de redirigir.
        headers: { Accept: 'application/json' },
      });
      sending.hide();

      if (response.ok) {
        showToast('¡Mensaje enviado! Te llevo a la confirmación...', { type: 'success' });
        contactForm.reset();
        // 2 segundos para que se lea el toast y después a gracias.html.
        // Esa página es la que cuenta la conversión: ahí van los píxeles
        // de Google Ads / Meta.
        redirecting = true;
        setTimeout(() => {
          window.location.href = 'gracias.html';
        }, 2000);
      } else {
        // .catch(() => null): si la respuesta de error no es JSON, no rompemos.
        const data = await response.json().catch(() => null);
        showToast(data?.error || 'Hubo un problema al enviar. Probá de nuevo.', { type: 'error' });
      }
    } catch (error) {
      // fetch solo "falla" así si no hubo conexión (no por un error 4xx/5xx).
      sending.hide();
      showToast('No se pudo enviar. Revisá tu conexión e intentá de nuevo.', { type: 'error' });
    } finally {
      // finally corre SIEMPRE, haya salido bien o mal (incluso si hubiera un
      // return dentro del try). Si nos estamos yendo a gracias.html dejamos
      // el botón deshabilitado: así nadie manda el formulario dos veces
      // durante esos 2 segundos.
      if (submitButton && !redirecting) submitButton.disabled = false;
    }
  });
}

/* Arranque: cada init revisa si su parte existe en esta página. */
initNavigation();
initThemeToggle();
initTypewriter();
initQuoteCalculator();
initRunawayButton();
initScrollReveal();
initContactForm();
