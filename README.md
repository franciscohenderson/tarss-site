# Tarss — Soluciones Digitales

Landing page para ofrecer:
- creación de sitios web
- mantenimiento técnico
- redes sociales
- asesoría digital

## Archivos
- `index.html`
- `servicios.html`
- `contacto.html`
- `blog.html`
- `404.html`
- `styles.css`
- `scripts.js`

## Sitio público
El sitio ya está desplegado en Cloudflare Pages y listo para promoción:
- https://tarss-site.pages.dev/
- Contacto directo: https://tarss-site.pages.dev/contacto
- Gracias: https://tarss-site.pages.dev/gracias
- 404 personalizada: https://tarss-site.pages.dev/404

## Dominio personalizado
Si querés usar un dominio propio, agregá el dominio en Cloudflare Pages y configura un registro CNAME que apunte a `tarss-site.pages.dev`.

## SEO básico
- Cada página incluye `meta description`, `og:title`, `og:description`, `og:url` y `canonical`.
- Cambia los textos y meta tags según tu oferta real para mejorar la visibilidad.

## Blog
El sitio incluye una página de blog con ideas de contenido para atraer clientes y mostrar tu experiencia.

## Navegación móvil
El menú superior funciona en mobile con un botón hamburguesa para abrir y cerrar la navegación.
## Cómo usar
1. Copia los archivos a una carpeta.
2. Abre `index.html` en el navegador para ver la página local.
3. Para activar el formulario de contacto real, crea un formulario gratis en Formspree y reemplaza el `action` en `contacto.html` con tu ID de formulario.
4. Publica el sitio en GitHub y despliega en Cloudflare Pages.

## Publicar en GitHub + Cloudflare Pages
1. Crea un repositorio nuevo en GitHub llamado por ejemplo `tarss-site`.
2. Sube todos los archivos: `index.html`, `servicios.html`, `contacto.html`, `blog.html`, `styles.css`, `scripts.js`, `README.md`, `favicon.svg`.
3. Ve a https://dash.cloudflare.com/ y accede a Cloudflare Pages.
4. Crea un nuevo proyecto y conecta tu cuenta de GitHub.
5. Selecciona el repositorio y usa la rama principal (`main` o `master`).
6. Como `Build command` deja vacío y como `Build output directory` escribe `.`.
7. Publica el sitio. Cloudflare Pages generará una URL pública automáticamente.

## Publicar en Netlify
1. Con el repositorio en GitHub, ve a https://www.netlify.com/ y regístrate.
2. Conecta tu cuenta de GitHub.
3. Importa el repositorio.
4. Publica el sitio. Netlify generará una URL pública automáticamente.

## Qué incluye este proyecto
- Navegación responsive con menú móvil.
- Botón flotante de WhatsApp en todas las páginas.
- Animaciones suaves al hacer scroll.
- Sección de precios con paquetes y servicios.
- SEO básico con meta tags y favicon.

## Publicar sin Git
1. Ve a https://app.netlify.com/drop.
2. Arrastra la carpeta `Tarss-site`.
3. Netlify desplegará el sitio automáticamente.
4. Copia la URL pública y compártela con tus clientes.

## Checklist final
- [x] Navegación y menú móvil funcionan.
- [x] WhatsApp y email están disponibles en todas las páginas.
- [x] Formulario de contacto usa Formspree con un endpoint real.
- [x] Respuesta de confirmación: `https://tarss-site.pages.dev/gracias`.
- [x] Página 404 personalizada activa.
- [x] Sitio desplegado en Cloudflare Pages y accesible públicamente.

## Cambios recomendados
- Ajusta los textos y servicios según tu oferta real.
- Cambia el email por tu correo si lo deseas.
- Agrega más casos de éxito y un portafolio real.

## Mensajes para compartir
- WhatsApp:
  "Hola, soy [Nombre] y quiero un sitio web para mi negocio de [tipo de negocio]. Busco una web que venda más y tenga contacto directo por WhatsApp. ¿Podés enviarme una propuesta?"
- Publicación para redes:
  "Lanzá tu web profesional con Tarss. Diseño rápido, optimizado para ventas y desde USD 149. Contacto directo por WhatsApp."
- Mensaje corto:
  "¿Querés una web que convierta? Tarss hace sitios modernos para emprendedores y responde en menos de 24 horas."
