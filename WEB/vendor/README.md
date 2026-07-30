# WEB/vendor

`supabase-js.mjs` es `@supabase/supabase-js` empaquetado como un único archivo ESM, servido desde
el mismo origen que los dashboards. **No editarlo a mano.**

## Por qué está vendorizado

`WEB/supabase-demo.js` importaba el SDK desde `https://esm.sh/@supabase/supabase-js@2.110.3`. Ese
import dispara una cascada de 16 peticiones a un CDN de terceros (`auth-js`, `functions-js`,
`postgrest-js`, `realtime-js`, `storage-js`, `phoenix`, `iceberg-js`, `tslib` y 5 polyfills de
Node) antes de que cualquier dashboard pueda pedir datos. Los 7 HTML de `WEB/` cargan
`supabase-demo.js`, así que la cascada afectaba a todas las pantallas.

Vendorizar la salida de `esm.sh?bundle` bajó a 6 peticiones, pero dejaba los polyfills de Node como
archivos separados encadenados 3 niveles en serie (`supabase-js.mjs` → `process.mjs`/`buffer.mjs` →
`events.mjs`/`tty.mjs` → `async_hooks.mjs`). El bundle actual, hecho con esbuild, requiere una sola
petición local durante el uso de RENOVA y no carga los polyfills.

El SDK conserva un `import()` opcional de `@opentelemetry/api` para `tracePropagation`. RENOVA no
habilita esa opción, por lo que ese import queda inactivo y no genera una petición. Si en el futuro
se habilita tracing, hay que incorporar también esa dependencia al bundle.

Los polyfills de Node no hacen falta en el navegador: la única lectura real de `process` es
`process.version` dentro de `typeof process < "u"`, y el único uso real de `Buffer` es
`toBase64(t) { return typeof Buffer < "u" ? ... : btoa(t) }`. Ambos caen al camino de browser.

## Qué usa realmente el SDK

No recortar el bundle a `auth-js` + `realtime-js`: rompería el importador.

- `auth-js` — `signInWithPassword`, `getSession`, `signOut`, `onAuthStateChange` en
  `supabase-demo.js`.
- `realtime-js` — `supabase.channel()` en `onDataChange`.
- `postgrest-js` — `RenovaSupabase.supabase.rpc("save_inspection", …)` en `importar.html`.
- `storage-js`, `functions-js` — sin uso, pero `createClient` los instancia, así que no se pueden
  eliminar por tree-shaking sin parchear el SDK.

Las lecturas de los dashboards **no** pasan por el SDK: `fetchView` hace `fetch()` directo a
`/rest/v1`.

## Regenerar

Las versiones exactas del SDK y de esbuild están en `devDependencies` y en `package-lock.json`.
Con las dependencias instaladas desde el lockfile:

```sh
npm ci
npm audit signatures
npm run vendor:supabase
```

Para subir de versión, actualizar juntos `@supabase/supabase-js`, la constante
`SUPABASE_VERSION` de `scripts/build-supabase-vendor.mjs` y el lockfile. Después, regenerar y
verificar:

1. `grep -En '(^|;)import[[:space:]]|import\(' supabase-js.mjs` sólo devuelve el import dinámico
   opcional de `@opentelemetry/api`; RENOVA no debe activar `tracePropagation`.
2. Toda referencia a `process.` o `Buffer` sigue protegida por `typeof`. Si una versión nueva
   introduce un uso sin proteger, hay que shimear ese global dentro del mismo archivo — no volver a
   agregar archivos de polyfill separados.
3. Ejecutar `git diff --check` y `npm run docs:check`.

Smoke test mínimo: servir `WEB/` y confirmar en un dashboard que `RenovaSupabase` queda definido,
que `getSession()` resuelve, que `onDataChange` suscribe sin excepción y que la consola queda
limpia.
