#!/usr/bin/env node
/* ==========================================================================
   Cambiar el dominio del sitio en un solo paso.
   --------------------------------------------------------------------------
   Uso:   npm run set-domain -- tars.com.ar
          npm run set-domain -- tars.com.ar --dry-run   (solo muestra qué cambia)

   Reemplaza el dominio actual en todo lo que lo usa: canonical, Open Graph,
   datos estructurados, sitemap.xml, robots.txt, la redirección del
   formulario (_next de Formspree), el pie de los PDF y la documentación.
   No toca el código de Cloudflare ni las variables de entorno.

   Antes: el dominio tiene que estar conectado en Cloudflare Pages
   (Custom domains) y respondiendo. Después: correr `npm test`, commitear y
   pushear. Conviene también redirigir tarss-site.pages.dev al dominio nuevo
   (Cloudflare > Rules > Redirect Rules / Bulk Redirects).
   ========================================================================== */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CURRENT = 'tarss-site.pages.dev';
const FILES = [
  ...fs.readdirSync(ROOT).filter((f) => f.endsWith('.html') && f !== 'google6ceea57d20862a8a.html'),
  'sitemap.xml',
  'robots.txt',
  'README.md',
  'CLOUDFLARE-PAGES.md',
  'js/lib/pdf.js',
];

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const domain = (args.find((a) => !a.startsWith('--')) || '').trim().toLowerCase()
  .replace(/^https?:\/\//, '').replace(/\/+$/, '');

if (!/^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) {
  console.error('Indicá un dominio válido, por ejemplo: npm run set-domain -- tars.com.ar');
  process.exit(1);
}
if (domain === CURRENT) {
  console.error(`El sitio ya usa ${CURRENT}.`);
  process.exit(1);
}

let total = 0;
for (const rel of FILES) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) continue;
  const before = fs.readFileSync(file, 'utf8');
  const count = before.split(CURRENT).length - 1;
  if (!count) continue;
  total += count;
  console.log(`${dryRun ? '[prueba] ' : ''}${rel}: ${count} reemplazo(s)`);
  if (!dryRun) fs.writeFileSync(file, before.split(CURRENT).join(domain));
}

console.log(total
  ? `\n${dryRun ? 'Se cambiarían' : 'Listo:'} ${total} apariciones de ${CURRENT} -> ${domain}.`
  : `\nNo encontré ${CURRENT}: ¿ya se cambió el dominio?`);
if (!dryRun && total) {
  console.log('Siguiente: npm test, commit y push. Y redirigí tarss-site.pages.dev al dominio nuevo desde Cloudflare.');
}
