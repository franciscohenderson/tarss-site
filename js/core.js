/* Tars · núcleo (se carga en todas las páginas)
   Tema, menú, motor de scroll/desregistro, botones magnéticos y vigía del hero. */

import { prefersReducedMotion, hasFinePointer, clamp, createSpring, stepSpring } from './lib/env.js';

/* --- 2. Tema -------------------------------------------------------------- */
export function initThemeToggle() {
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
export function initNavigation() {
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
export function initRisoEngine() {
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

  /* Medidas que solo cambian al redimensionar (memo): se calculan una vez y
     en resize, no en cada cuadro. Antes se pedían en cada tick y obligaban
     al navegador a recalcular estilos y layout. */
  const measures = { stick: 0, range: 1, tapeHalf: 0 };
  function measure() {
    // Los afiches se fijan en «top» (0 en escritorio, 64px bajo la barra en
    // celular): el recorrido útil es desde el borde de abajo hasta ahí.
    measures.stick = posters.length ? parseFloat(getComputedStyle(posters[0]).top) || 0 : 0;
    measures.range = Math.max(1, window.innerHeight - measures.stick);
    measures.tapeHalf = tapeTrack ? tapeTrack.scrollWidth / 2 : 0;
  }
  measure();

  // Último valor escrito de cada variable: si no cambió, no se reescribe
  // (escribir un estilo igual igual invalida y cuesta).
  const written = new Map();
  function write(element, name, value) {
    const key = element === root ? name : element;
    const previous = written.get(key);
    if (previous && previous[name] === value) return;
    element.style.setProperty(name, value);
    written.set(key, { ...previous, [name]: value });
  }

  /* LECTURA: todas las posiciones juntas, antes de escribir nada. Intercalar
     leer/escribir (como antes) forzaba un layout por afiche en cada cuadro. */
  function readPosters() {
    if (!postersVisible || posters.length === 0) return null;
    return posters.map((poster) => poster.getBoundingClientRect().top - measures.stick);
  }

  /* ESCRITURA: con las posiciones ya leídas. */
  function writePosters(tops) {
    if (!tops) return;
    tops.forEach((top, index) => {
      const enter = clamp(1 - top / measures.range, 0, 1);
      const next = tops[index + 1];
      const cover = next === undefined ? 0 : clamp(1 - next / measures.range, 0, 1);
      write(sheets[index], '--enter', enter.toFixed(3));
      write(sheets[index], '--cover', cover.toFixed(3));
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

    // 1) Lecturas (layout) -> 2) cálculo -> 3) escrituras (estilo).
    const tops = readPosters();
    const movingX = stepSpring(springX, dt);
    const movingY = stepSpring(springY, dt);

    write(root, '--rx', `${(BASE_X + springX.value).toFixed(2)}px`);
    write(root, '--ry', `${(BASE_Y + springY.value).toFixed(2)}px`);
    if (tapeTrack && measures.tapeHalf > 0) {
      write(tapeTrack, '--tape-x', `${(-((scrollY * 0.35) % measures.tapeHalf)).toFixed(1)}px`);
    }
    writePosters(tops);

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

  window.addEventListener('resize', () => { measure(); schedule(); }, { passive: true });
  // Las fuentes web cambian el ancho de la cinta al terminar de cargar.
  document.fonts?.ready.then(() => { measure(); schedule(); });

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

  schedule();
}

/* --- 5. Botones magnéticos ------------------------------------------------- */
export function initMagnetic() {
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

    // Centro del botón medido una vez al entrar el mouse (restando el
    // corrimiento magnético actual), no en cada pointermove.
    let center = null;
    element.addEventListener('pointerenter', (event) => {
      if (event.pointerType !== 'mouse') return;
      const rect = element.getBoundingClientRect();
      center = { x: rect.left + rect.width / 2 - sx.value, y: rect.top + rect.height / 2 - sy.value };
    });
    element.addEventListener('pointermove', (event) => {
      if (event.pointerType !== 'mouse' || !center) return;
      sx.target = clamp((event.clientX - center.x) * 0.3, -10, 10);
      sy.target = clamp((event.clientY - center.y) * 0.4, -8, 8);
      start();
    });
    element.addEventListener('pointerleave', () => {
      center = null;
      sx.target = 0;
      sy.target = 0;
      start();
    });
  });
}

/* Mientras se ve el hero, el sello flotante de WhatsApp se esconde: el
   hero ya tiene su propio botón de WhatsApp y se pisarían. */
export function initHeroWatch() {
  const hero = document.querySelector(".hero");
  if (!hero || !("IntersectionObserver" in window)) return;
  new IntersectionObserver((entries) => {
    document.body.classList.toggle("hero-in-view", entries[0].isIntersecting);
  }, { threshold: 0.35 }).observe(hero);
}

