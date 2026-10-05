#!/usr/bin/env node
/* ==========================================================================
   Imágenes para compartir (Open Graph) · `npm run og`
   --------------------------------------------------------------------------
   Genera og/<página>.jpg (1200x630) con la estética de la portada usando el
   Chromium de Playwright, y actualiza en cada HTML las etiquetas og:image,
   og:image:width/height/alt y twitter:image.

   Es lo que muestran WhatsApp, Facebook, LinkedIn y X al compartir un link.
   Antes se usaba favicon.svg, que esas apps no muestran (no aceptan SVG).

   Para cambiar un texto: editar PAGES y volver a correr `npm run og`.
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'og');
// El dominio sale del canonical de index.html: así sigue a `npm run set-domain`.
const SITE = (fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').match(/<link rel="canonical" href="(https:\/\/[^/"]+)/) || [])[1];
if (!SITE) throw new Error('No encontré el canonical de index.html');

// title: lo que va entre *asteriscos* sale en rosa. photos: franjas de rubros a la derecha (solo la portada).
const PAGES = [
  { file: 'index.html', image: 'inicio', kicker: 'Todo el país · webs a medida', title: 'Webs para *tu negocio*', size: 132, note: 'Con asistente de IA para tu WhatsApp · desde USD 149', photos: true },
  { file: 'servicios.html', image: 'servicios', kicker: 'Landing · sitio completo · asistente de IA', title: 'Servicios *y precios*', size: 150, note: 'Qué incluye cada uno y cuánto sale' },
  { file: 'contacto.html', image: 'contacto', kicker: 'Propuesta en menos de 24 horas', title: '*Escribime*', size: 190, note: 'WhatsApp · email · formulario' },
  { file: 'blog.html', image: 'blog', kicker: 'Consejos para negocios', title: '*Blog*', size: 240, note: 'Webs que venden, celular y mantenimiento' },
  { file: 'terminos.html', image: 'terminos', kicker: 'En lenguaje claro', title: 'Términos *y condiciones*', size: 128, note: 'Cómo trabajo y qué derechos tenés' },
  { file: 'contrato.html', image: 'contrato', kicker: 'Para completar y firmar', title: 'Contrato *modelo*', size: 150, note: 'Contrato directo con Francisco Miranda Henderson' },
  { file: 'privacidad.html', image: 'privacidad', kicker: 'Qué datos se usan y para qué', title: 'Política de *privacidad*', size: 120, note: 'Tars · Mendoza' },
  { file: 'articulo-asistente-ia-whatsapp.html', image: 'articulo-asistente-ia-whatsapp', kicker: 'Blog', title: 'Asistente de IA para *WhatsApp*: qué hace y qué no', size: 96, note: '4 min de lectura' },
  { file: 'articulo-landing-profesional.html', image: 'articulo-landing-profesional', kicker: 'Blog', title: '5 razones para tener una *landing profesional*', size: 92, note: '4 min de lectura' },
  { file: 'articulo-sitio-en-celular.html', image: 'articulo-sitio-en-celular', kicker: 'Blog', title: 'Tu web, *bien en celular*', size: 128, note: '5 min de lectura' },
  { file: 'articulo-mantenimiento-web.html', image: 'articulo-mantenimiento-web', kicker: 'Blog', title: 'Qué incluye el *mantenimiento web*', size: 104, note: '4 min de lectura' },
];
const PHOTOS = [['gimnasio', '45% 30%'], ['barberia', '40% 35%'], ['restaurante', '50% 30%'], ['ropa', '50% 20%']];
const photo = (name) => `data:image/webp;base64,${fs.readFileSync(path.join(ROOT, 'prototipos', 'img', `${name}.webp`)).toString('base64')}`;
const plain = (s) => s.replace(/\*/g, '');

const font = (file) => `data:font/woff2;base64,${fs.readFileSync(path.join(ROOT, 'fonts', file)).toString('base64')}`;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

function template(p) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
  @font-face { font-family: 'BSD'; font-weight: 100 900; src: url('${font('big-shoulders-display-var.woff2')}') format('woff2'); }
  @font-face { font-family: 'LF'; font-weight: 100 900; src: url('${font('libre-franklin-var.woff2')}') format('woff2'); }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; background: #0e0e10; color: #f3efe7; font-family: 'LF', sans-serif; position: relative; overflow: hidden; }
  /* El panel de inicio de la portada: brillo rosa, TARS calado y puntos de tinta. */
  .card { position: absolute; inset: 18px ${p.photos ? '388px' : '18px'} 18px 18px; overflow: hidden; border-radius: 30px; background: radial-gradient(80% 90% at 78% 18%, #4a1238, #1a0d16 58%, #17171a); }
  .dots { position: absolute; inset: 0; background-image: radial-gradient(circle, rgb(255 72 176 / .55) 1.4px, transparent 1.8px); background-size: 9px 9px; -webkit-mask-image: radial-gradient(40% 50% at 74% 26%, #000, transparent 70%); mask-image: radial-gradient(40% 50% at 74% 26%, #000, transparent 70%); }
  .ghost { position: absolute; left: 30px; top: -6px; font: 900 260px/.82 'BSD'; letter-spacing: .02em; color: transparent; -webkit-text-stroke: 2px rgb(255 72 176 / .5); }
  .veil { position: absolute; inset: 0; background: linear-gradient(0deg, rgb(14 9 13 / .92), rgb(14 9 13 / .55) 45%, transparent 75%); }
  .main { position: absolute; left: 56px; right: 56px; bottom: 120px; }
  .kicker { margin-bottom: 18px; font-weight: 800; font-size: 22px; letter-spacing: .16em; text-transform: uppercase; color: #ff48b0; }
  .title { font: 900 ${p.size}px/.88 'BSD'; text-transform: uppercase; text-wrap: balance; }
  .title em { font-style: normal; color: #ff48b0; }
  .foot { position: absolute; left: 56px; right: 56px; bottom: 44px; display: flex; align-items: center; justify-content: space-between; gap: 24px; }
  .note { font-weight: 600; font-size: 24px; color: #d9d4cb; }
  .pill { flex: none; padding: 12px 22px; border-radius: 999px; background: #ff48b0; color: #120a10; font-weight: 800; font-size: 22px; }
  .strips { position: absolute; top: 18px; right: 18px; bottom: 18px; width: 362px; display: flex; gap: 8px; }
  .strips div { position: relative; flex: 1; overflow: hidden; border-radius: 22px; background: #17171a; }
  .strips img { width: 100%; height: 100%; object-fit: cover; filter: grayscale(1) brightness(.62) contrast(1.05); }
  .strips div::after { content: ""; position: absolute; inset: 0; background: linear-gradient(0deg, rgb(8 8 10 / .85), transparent 55%); }
  .grain { position: absolute; inset: 0; opacity: .07; mix-blend-mode: overlay; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }
  </style></head><body>
  <div class="card">
    <div class="dots"></div>
    <div class="ghost">TARS</div>
    <div class="veil"></div>
    <div class="main">
      <p class="kicker">${esc(p.kicker)}</p>
      <h1 class="title">${esc(p.title).replace(/\*([^*]+)\*/g, '<em>$1</em>')}</h1>
    </div>
    <div class="foot"><span class="note">${esc(p.note)}</span><span class="pill">${esc(SITE.replace('https://', ''))}</span></div>
  </div>
  ${p.photos ? `<div class="strips">${PHOTOS.map(([n, pos]) => `<div><img src="${photo(n)}" style="object-position:${pos}"></div>`).join('')}</div>` : ''}
  <div class="grain"></div>
  </body></html>`;
}

function updateMeta(p) {
  const file = path.join(ROOT, p.file);
  let html = fs.readFileSync(file, 'utf8');
  const nl = html.includes('\r\n') ? '\r\n' : '\n';
  const url = `${SITE}/og/${p.image}.jpg`;
  const alt = `${p.kicker} · ${plain(p.title)} · Tars`;
  const tags = [
    `<meta property="og:image" content="${url}" />`,
    `  <meta property="og:image:width" content="1200" />`,
    `  <meta property="og:image:height" content="630" />`,
    `  <meta property="og:image:alt" content="${esc(alt)}" />`,
    `  <meta name="twitter:image" content="${url}" />`,
  ].join(nl);
  // Quita lo generado antes (para poder correr el script varias veces) y
  // reemplaza la og:image vieja.
  html = html.replace(/\r?\n\s*<meta property="og:image:(width|height|alt)" content="[^"]*" \/>/g, '');
  html = html.replace(/\r?\n\s*<meta name="twitter:image" content="[^"]*" \/>/g, '');
  if (!/<meta property="og:image" content="[^"]*" \/>/.test(html)) throw new Error(`${p.file}: no tiene og:image`);
  html = html.replace(/<meta property="og:image" content="[^"]*" \/>/, tags);
  fs.writeFileSync(file, html);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  for (const p of PAGES) {
    await page.setContent(template(p));
    await page.evaluate(() => document.fonts.ready);
    const target = path.join(OUT, `${p.image}.jpg`);
    await page.screenshot({ path: target, type: 'jpeg', quality: 86 });
    updateMeta(p);
    console.log(`og/${p.image}.jpg  ${(fs.statSync(target).size / 1024).toFixed(0)} KB  -> ${p.file}`);
  }
  await browser.close();
})().catch((error) => { console.error(error); process.exit(1); });
