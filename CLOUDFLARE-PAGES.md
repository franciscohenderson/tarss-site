# Cloudflare Pages — Despliegue para `tarss-site`

Guía rápida para conectar el repositorio `franciscohenderson/tarss-site` a Cloudflare Pages.

## Resumen
El sitio es estático (HTML/CSS/JS). Cloudflare Pages puede desplegarlo directamente desde GitHub sin comando de build.

## Pasos (Web UI)
1. Abre https://dash.cloudflare.com/ y entra a la sección **Pages**.
2. Haz clic en **Create a project**.
3. Conecta tu cuenta de GitHub y autoriza el repositorio `franciscohenderson/tarss-site`.
4. Selecciona el repositorio y la rama `main`.
5. En **Build settings**:
   - Build command: (dejar vacío)
   - Build output directory: `.`
6. Haz clic en **Save and Deploy**. Cloudflare Pages iniciará la primera construcción y te dará una URL del estilo `https://<project-name>.pages.dev/`.

## Dominio personalizado
- En el panel del proyecto, ve a **Custom domains** → **Add a domain**.
- Agrega tu dominio (ej. `midominio.com`).
- Cloudflare te dará instrucciones DNS. Generalmente:
  - Para subdominio `www`: añade un CNAME a `tars.com.ar`.
  - Para dominio raíz: configura un registro `A` con los valores que Cloudflare indique o usa el método recomendado por Pages.
- Verifica y activa la opción de HTTPS (Cloudflare gestiona certificados automáticamente).

## Archivos útiles ya incluidos
- `robots.txt` — permite rastreo y referencia a `sitemap.xml`.
- `sitemap.xml` — listado de las páginas principales.
- `404.html` — página personalizada para rutas no encontradas.

## Comandos útiles (local)
Comprueba que los cambios estén en `main` y subidos a GitHub:

```powershell
# Ver remotos
git remote -v

# Ver rama actual
git branch --show-current

# Empujar cambios a GitHub (si hace falta)
git add .
git commit -m "Add Cloudflare Pages instructions and SEO files"
git push origin main
```

## Notas y recomendaciones
- Si usás una rama distinta a `main`, seleccionala en el paso de Pages.
- Para redirecciones avanzadas o single-page app, crear un archivo `_redirects` o configuración adicional según necesidad.
- Cloudflare Pages detecta `404.html` en la raíz; asegúrate de mantenerlo.

Si querés, puedo: crear el archivo `wrangler.toml` básico, añadir un `CNAME` (solo si me das el dominio), o preparar commits adicionales. Dime qué preferís hacer ahora.
