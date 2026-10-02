#!/usr/bin/env node
/* ==========================================================================
   Imágenes para compartir (Open Graph) · `npm run og`
   --------------------------------------------------------------------------
   Genera og/<página>.png (1200x630) con la estética «Imprenta Riso» usando el
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

const PAGES = [
  { file: 'index.html', image: 'inicio', kicker: 'Ayudo a tu negocio a', title: 'VENDER MÁS', size: 190, note: 'Webs rápidas y claras · desde USD 149' },
  { file: 'servicios.html', image: 'servicios', kicker: 'Webs, mantenimiento, redes y asesoría', title: 'PAQUETES Y PRECIOS', size: 140, note: 'Cotizá en segundos y pedilo por WhatsApp' },
  { file: 'contacto.html', image: 'contacto', kicker: 'Propuesta en menos de 24 horas', title: 'ESCRIBIME', size: 200, note: 'WhatsApp · email · formulario' },
  { file: 'blog.html', image: 'blog', kicker: 'Consejos para emprendedores', title: 'BLOG', size: 260, note: 'Webs que venden, celular y mantenimiento' },
  { file: 'privacidad.html', image: 'privacidad', kicker: 'Qué datos se usan y para qué', title: 'POLÍTICA DE PRIVACIDAD', size: 120, note: 'Tars 2.0 · Mendoza' },
  { file: 'articulo-landing-profesional.html', image: 'articulo-landing-profesional', kicker: 'Blog', title: '5 RAZONES PARA TENER UNA LANDING PROFESIONAL', size: 96, note: '4 min de lectura' },
  { file: 'articulo-sitio-en-celular.html', image: 'articulo-sitio-en-celular', kicker: 'Blog', title: 'TU WEB, BIEN EN CELULAR', size: 132, note: '5 min de lectura' },
  { file: 'articulo-mantenimiento-web.html', image: 'articulo-mantenimiento-web', kicker: 'Blog', title: 'QUÉ INCLUYE EL MANTENIMIENTO WEB', size: 112, note: '4 min de lectura' },
];

const font = (file) => `data:font/woff2;base64,${fs.readFileSync(path.join(ROOT, 'fonts', file)).toString('base64')}`;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

function template(p) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
  @font-face { font-family: 'BSD'; font-weight: 100 900; src: url('${font('big-shoulders-display-var.woff2')}') format('woff2'); }
  @font-face { font-family: 'LF'; font-weight: 100 900; src: url('${font('libre-franklin-var.woff2')}') format('woff2'); }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; background: #141414; color: #f1ece2; font-family: 'LF', sans-serif; position: relative; overflow: hidden; }
  .margin { position: absolute; inset: 0 auto 0 0; width: 96px; border-right: 3px solid #f1ece2; display: flex; flex-direction: column; align-items: center; padding-top: 34px; }
  .brand { font-family: 'BSD'; font-weight: 900; font-size: 52px; line-height: .9; text-align: center; }
  .brand span { color: #ff48b0; display: block; }
  .main { position: absolute; left: 150px; right: 250px; /* deja libre la columna del sello */ top: 70px; bottom: 120px; display: flex; flex-direction: column; justify-content: center; }
  .kicker { font-weight: 800; font-size: 34px; margin-bottom: 18px; }
  .title { position: relative; font-family: 'BSD'; font-weight: 900; font-size: ${p.size}px; line-height: .98; /* aire para los acentos (Á, É) */ text-transform: uppercase; isolation: isolate; color: #f1ece2; }
  .title::before, .title::after { content: attr(data-text); position: absolute; inset: 0; z-index: -1; mix-blend-mode: screen; }
  .title::before { color: #ff48b0; transform: translate(9px, 6px); }
  .title::after { color: #0078bf; transform: translate(-8px, -4px); }
  .tape { position: absolute; left: -20px; right: -20px; bottom: 34px; height: 74px; background: #ffe800; color: #141414; transform: rotate(-2deg); display: flex; align-items: center; justify-content: space-between; padding: 0 90px 0 150px; font-family: 'BSD'; font-weight: 900; font-size: 38px; text-transform: uppercase; }
  .stamp { position: absolute; top: 46px; right: 56px; width: 150px; height: 150px; border-radius: 50%; background: #ff48b0; color: #141414; display: grid; place-items: center; text-align: center; font-family: 'BSD'; font-weight: 900; font-size: 34px; line-height: .9; transform: rotate(12deg); }
  .grain { position: absolute; inset: 0; opacity: .08; mix-blend-mode: overlay; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }
  </style></head><body>
  <div class="margin"><div class="brand">T<span>2</span></div></div>
  <div class="stamp">TARS<br>2.0</div>
  <div class="main">
    <p class="kicker">${esc(p.kicker)}</p>
    <h1 class="title" data-text="${esc(p.title)}">${esc(p.title)}</h1>
  </div>
  <div class="tape"><span>${esc(p.note)}</span><span>${esc(SITE.replace('https://', ''))}</span></div>
  <div class="grain"></div>
  </body></html>`;
}

function updateMeta(p) {
  const file = path.join(ROOT, p.file);
  let html = fs.readFileSync(file, 'utf8');
  const nl = html.includes('\r\n') ? '\r\n' : '\n';
  const url = `${SITE}/og/${p.image}.png`;
  const alt = `${p.kicker} · ${p.title.charAt(0) + p.title.slice(1).toLowerCase()} · Tars 2.0`;
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
    const target = path.join(OUT, `${p.image}.png`);
    await page.screenshot({ path: target, type: 'png' });
    updateMeta(p);
    console.log(`og/${p.image}.png  ${(fs.statSync(target).size / 1024).toFixed(0)} KB  -> ${p.file}`);
  }
  await browser.close();
})().catch((error) => { console.error(error); process.exit(1); });
