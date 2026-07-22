# task_07 — Navegación y bundle estático

## 1. Propietario

**CODEX.**

## 2. Objetivo y resultado observable

«Servicios» es alcanzable desde las 8 superficies web, y el bundle estático contiene la página y sus
módulos.

Es la tarea de mayor riesgo de regresión de la fase: toca 8 archivos en producción para insertar un
enlace.

## 3. Dependencias y bloqueos

Depende de `task_06`. Bloquea `task_08`.

## 4. Archivos exclusivos

- `WEB/INSPECCIONES POR FECHA.html`
- `WEB/Inspecciones por unidad.html`
- `WEB/rendimiento.html`
- `WEB/historial-neumatico.html`
- `WEB/importar.html`
- `WEB/inventario.html`
- `WEB/neumaticos.html`
- `WEB/instalacion.html`
- `scripts/prepare-static-hosting.mjs`

Solo lectura: `WEB/renova-office-shell.css`, `WEB/servicios.html`.

## 5. Contratos

`AUDIT.md` §9 (mapa de navegación y sus divergencias).

## 6. Pasos

1. Insertar `<a href="servicios.html">Servicios</a>` después de «Inventario» en cada nav, respetando
   la variante de cada archivo:

   | Archivo | Línea aprox. | Variante |
   |---|---|---|
   | `WEB/INSPECCIONES POR FECHA.html` | 244 | `nav.screen-nav` |
   | `WEB/rendimiento.html` | 377 | `nav.screen-nav` |
   | `WEB/historial-neumatico.html` | 152 | `nav.screen-nav` |
   | `WEB/importar.html` | 163 | `nav.screen-nav` |
   | `WEB/inventario.html` | 25 | `nav.nav` |
   | `WEB/neumaticos.html` | 25 | `nav.nav` |
   | `WEB/instalacion.html` | 171 | `nav.nav` |
   | `WEB/Inspecciones por unidad.html` | 446 | `a.chip` en `.hdr-right` |

   Las líneas son orientativas: localizar el `<nav>` por contenido, no por número.

2. `scripts/prepare-static-hosting.mjs`, **dos ediciones**:
   - añadir `'servicios.html'` al array de archivos HTML del primer bucle (junto a `'neumaticos.html'`);
   - añadir `'servicios'` al array de directorios del segundo bucle
     (`['inventario','movimientos','buscador','shared','neumaticos']`).

   El bucle de directorios copia solo `.js` y `.css`, así que `package.json`, `vitest.config.js` y
   `__tests__/` quedan fuera solos: **no hay que excluir nada a mano.**

3. Verificar que ninguna pantalla perdió su marcado de activo ni su propia lista de enlaces.

## 7. Invariantes

- **No unificar los navs** (D12). Las clases divergentes y las listas distintas entre archivos son
  deuda registrada; mezclar esa refactorización con una funcionalidad nueva hace que un fallo de
  cualquiera de las dos contamine la otra y complica el rollback.
- **No cambiar el orden de los enlaces existentes** en ninguna pantalla.
- **No añadir enlaces que ese archivo no tenía.** `inventario.html` no enlaza Neumáticos y
  `neumaticos.html` no enlaza Importar: así estaban, así siguen.
- Cada archivo conserva su `class="active"` / `aria-current` en el enlace propio.
- No modificar `WEB/servicios.html` ni `WEB/servicios/`.

## 8. Casos de error

- **Sin la segunda edición del script, la página se despliega y sus módulos dan 404.** Es el error
  silencioso más probable de esta tarea: el HTML aparece, la pantalla queda en blanco, y en local
  funcionaba.
- `Inspecciones por unidad.html` usa `a.chip` dentro de `.hdr-right`, no `nav`. Insertar un `<a>`
  suelto ahí rompe la fila. Seguir la variante.
- `historial-neumatico.html` no marca ninguna pantalla como activa: no inventar un `active`.
- Un enlace mal escrito (`Servicios.html`, `servicios.HTML`) funciona en local y falla en hosting
  sensible a mayúsculas.

## 9. Aceptación

1. Desde **cada una** de las 8 pantallas, el enlace «Servicios» está presente y navega.
2. Desde `servicios.html` se vuelve a cada una de las 8.
3. Ninguna pantalla perdió enlaces, orden ni marcado de activo — comparar contra `git diff`.
4. `node scripts/prepare-static-hosting.mjs` (requiere `app/dist`) produce:
   - `deploy-static/web/servicios.html`
   - `deploy-static/web/servicios/data.js`
   - `deploy-static/web/servicios/servicios-model.js`
   - `deploy-static/web/servicios/servicios-controller.js`
   - `deploy-static/web/servicios/servicios.css`
   y **no** produce `deploy-static/web/servicios/package.json`, `vitest.config.js` ni `__tests__/`.
5. Servir el bundle y abrir `servicios.html` desde ahí: carga, sin 404 en la pestaña de red.
6. `git diff --check` limpio. El diff de los 8 HTML es de una línea cada uno.

## 10. Rollback

Revertir los 9 archivos con `git checkout`. `WEB/servicios/` y `WEB/servicios.html` quedan en el
árbol pero inalcanzables desde la navegación, que es un estado seguro.

## 11. Handoff

Actualizar la fila 07 de `STATE.md` con: las 8 pantallas verificadas, el contenido del bundle, y
cualquier divergencia de nav encontrada que no estuviera en `AUDIT.md` §9.

Si al abrir un HTML aparece un nav que no coincide con lo documentado, **registrarlo** — el mapa de
`AUDIT.md` se hizo por lectura y puede haber envejecido.

`task_08` valida el flujo completo de punta a punta sobre este estado.
