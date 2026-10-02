/* Tars · tinta viva en el hero (index)
   Un lienzo WebGL detrás de «VENDER MÁS»: manchas de tinta rosa y azul,
   impresas en trama de puntos (como la risografía) y corridas entre sí (el
   desregistro de la marca). Al cargar, la tinta salpica sola; después sigue
   al mouse o al dedo. Es lo único que se mueve en la pantalla.
   - No toca el layout ni el texto: el LCP y el CLS siguen iguales.
   - Se duerme cuando el hero no se ve o la pestaña está oculta.
   - Con «reducir movimiento» pinta un solo cuadro quieto.
   - Sin WebGL no hace nada (el hero queda como siempre). */

import { prefersReducedMotion } from '../lib/env.js';

const MAX_POINTS = 16;

const VERTEX = `attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAGMENT = `
precision mediump float;
uniform vec2 u_res;
uniform float u_dpr;
uniform float u_time;
uniform float u_light;
uniform vec3 u_pts[${MAX_POINTS}];

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}

// Densidad de tinta: manchas lentas de fondo + lo que dejó el cursor.
float field(vec2 uv) {
  vec2 q = uv * 2.2 + vec2(u_time * 0.03, -u_time * 0.02);
  vec2 w = vec2(fbm(q + 1.7), fbm(q + 9.2));
  float base = smoothstep(0.58, 0.86, fbm(q + w * 1.6)) * 0.5;
  float d = 0.0;
  for (int i = 0; i < ${MAX_POINTS}; i++) {
    vec3 pt = u_pts[i];
    vec2 dp = uv - pt.xy;
    float r = 0.075 + 0.07 * (1.0 - pt.z);
    d += pt.z * exp(-dot(dp, dp) / (r * r));
  }
  d *= 0.55 + 0.9 * fbm(uv * 6.0 + u_time * 0.12); // bordes de tinta despareja
  return clamp(base + d, 0.0, 1.0);
}

// Trama: cada celda es un punto cuyo tamaño depende de la densidad.
float dots(vec2 frag, float density, float angle, float cell) {
  float s = sin(angle), c = cos(angle);
  vec2 r = mat2(c, -s, s, c) * frag;
  vec2 m = mod(r, cell) - cell * 0.5;
  float rad = sqrt(density) * cell * 0.64;
  return 1.0 - smoothstep(rad - 0.9, rad + 0.6, length(m));
}

void main() {
  vec2 frag = gl_FragCoord.xy / u_dpr;
  vec2 uv = frag / min(u_res.x, u_res.y);
  float pink = dots(frag, field(uv), 0.26, 7.0);
  float blue = dots(frag + 2.5, field(uv + vec2(0.014, -0.009)) * 0.85, 1.31, 7.0);
  vec3 P = vec3(1.0, 0.282, 0.69);
  vec3 B = vec3(0.0, 0.47, 0.749);
  // Oscuro: se suma a la tinta negra (el CSS lo mezcla en «screen»).
  // Claro: se multiplica sobre el papel (el CSS lo mezcla en «multiply»).
  vec3 dark = P * pink + B * blue;
  vec3 light = mix(vec3(1.0), P, pink) * mix(vec3(1.0), B, blue);
  gl_FragColor = vec4(mix(dark, light, u_light), 1.0);
}`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
}

export function initInk() {
  const canvas = document.querySelector('.hero-ink');
  const hero = canvas?.closest('.hero');
  if (!canvas || !hero) return;
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) return;

  const vs = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  if (!vs || !fs) return;
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const u = (name) => gl.getUniformLocation(program, name);
  const uRes = u('u_res'), uDpr = u('u_dpr'), uTime = u('u_time'), uLight = u('u_light'), uPts = u('u_pts');

  // Puntos de tinta: x, y (en la misma escala que el shader) y fuerza (se apaga sola).
  const points = new Float32Array(MAX_POINTS * 3);
  let next = 0;
  let width = 0, height = 0, dpr = 1;

  function resize() {
    const rect = hero.getBoundingClientRect();
    // En táctiles (celulares, a veces modestos) se dibuja a resolución 1: la trama igual se ve nítida.
    dpr = Math.min(window.devicePixelRatio || 1, window.matchMedia('(pointer: coarse)').matches ? 1 : 1.5);
    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function drop(clientX, clientY, strength = 1) {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(width, height);
    points[next * 3] = (clientX - rect.left) / scale;
    points[next * 3 + 1] = (rect.bottom - clientY) / scale; // WebGL cuenta desde abajo
    points[next * 3 + 2] = strength;
    next = (next + 1) % MAX_POINTS;
  }

  const light = () => (document.documentElement.getAttribute('data-theme') === 'light' ? 1 : 0);
  const t0 = performance.now();
  function draw(now) {
    gl.uniform2f(uRes, width, height);
    gl.uniform1f(uDpr, dpr);
    gl.uniform1f(uTime, (now - t0) / 1000);
    gl.uniform1f(uLight, light());
    gl.uniform3fv(uPts, points);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // Salpicadura de entrada: una diagonal de gotas sobre el título.
  function splash(stagger) {
    const rect = hero.getBoundingClientRect();
    const drops = [[0.18, 0.32], [0.3, 0.42], [0.46, 0.36], [0.6, 0.5], [0.74, 0.44], [0.86, 0.62]];
    drops.forEach(([x, y], i) => {
      const go = () => drop(rect.left + rect.width * x, rect.top + rect.height * y, 1.15);
      if (stagger) setTimeout(go, 120 + i * 110); else go();
    });
  }

  resize();
  canvas.classList.add('is-on');

  if (prefersReducedMotion) {
    splash(false);
    draw(t0 + 8000);
    new ResizeObserver(() => { resize(); draw(t0 + 8000); }).observe(hero);
    return;
  }

  let visible = true;
  let frame = 0;
  let last = performance.now();
  let lastDrop = 0;
  let lastDraw = 0;

  function tick(now) {
    frame = 0;
    if (!visible || document.hidden) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    let active = 0;
    for (let i = 0; i < MAX_POINTS; i++) {
      points[i * 3 + 2] *= Math.exp(-dt * 0.85);
      active = Math.max(active, points[i * 3 + 2]);
    }
    // Con tinta fresca, 60 cuadros; quieta, alcanza con unos 24 (ahorra batería).
    if (active > 0.05 || now - lastDraw > 42) {
      draw(now);
      lastDraw = now;
    }
    frame = requestAnimationFrame(tick);
  }
  const wake = () => { if (!frame && visible && !document.hidden) { last = performance.now(); frame = requestAnimationFrame(tick); } };

  hero.addEventListener('pointermove', (event) => {
    const now = performance.now();
    if (now - lastDrop < 28) return;
    lastDrop = now;
    drop(event.clientX, event.clientY, event.pointerType === 'mouse' ? 0.9 : 1.1);
    wake();
  }, { passive: true });
  hero.addEventListener('pointerdown', (event) => { drop(event.clientX, event.clientY, 1.4); wake(); }, { passive: true });

  new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; wake(); }).observe(hero);
  document.addEventListener('visibilitychange', wake);
  new ResizeObserver(() => { resize(); wake(); }).observe(hero);
  new MutationObserver(wake).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  splash(true);
  wake();
}
