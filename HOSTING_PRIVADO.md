# Hosting privado para la demo

Si no vas a llevar la laptop, **no** sirve exponer un servidor local temporal. Lo correcto es subir un build estático a un hosting persistente y entrar desde el iPad por una URL pública.

Este repo ya queda preparado para eso con:

```bash
npm run deploy:bundle
```

Ese comando genera `deploy-static/` con:

- la app web compilada en la raíz
- los dashboards HTML en `deploy-static/web/`

## Opción recomendada: Cloudflare Pages con Direct Upload

No requiere hacer público el repo.

1. Ejecutar:

   ```bash
   npm run deploy:bundle
   ```

2. Entrar a Cloudflare Pages:
   `Workers & Pages` → `Create application` → `Pages` → `Upload assets`
3. Subir el contenido de `deploy-static/`.
4. Abrir la URL pública que entrega Cloudflare.

La app quedará en `/` y los dashboards en `/web/`.

Ejemplos:

- `/`
- `/web/rendimiento.html`
- `/web/instalacion.html`

## Alternativas válidas sin repo público

### Vercel

Podés importar el repo privado desde GitHub o subir el build manualmente desde Vercel.

- Framework: `Vite`
- Root directory: `app`
- Build command: `npm run build`
- Output directory: `dist`

Después copiá también los archivos de `WEB/` dentro de `dist/web/`, o usá directamente el bundle `deploy-static/` con upload manual si elegís esa vía.

### Netlify

También permite enlazar repos privados específicos o publicar manualmente un build ya generado.

Si usás publicación manual, subí `deploy-static/`.

## Notas

- `WEB/supabase-config.public.js` ya usa la URL pública y la anon key publicable de Supabase. Eso sí se puede publicar; la protección real está en RLS.
- Para la demo, compartí una sola URL corta al supervisor. Lo más limpio es usar la raíz `/` para la app y guardar aparte los links de los dashboards.
