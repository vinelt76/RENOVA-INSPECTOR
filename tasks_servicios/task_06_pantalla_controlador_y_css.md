# task_06 — Pantalla, controlador y CSS

## 1. Propietario

**CODEX.**

## 2. Objetivo y resultado observable

`WEB/servicios.html` funciona: carga servicios reales, filtra por chips, muestra total y distribución
por tipo, lista las filas y enruta a Unidad y Neumático. Consola limpia.

## 3. Dependencias y bloqueos

Depende de `task_05`. Bloquea `task_07`.

## 4. Archivos exclusivos

- `WEB/servicios.html`
- `WEB/servicios/servicios-controller.js`
- `WEB/servicios/servicios.css`

Solo lectura: `WEB/servicios/{data.js,servicios-model.js}`, `WEB/shared/*`,
`WEB/neumaticos/neumaticos-controller.js` y `WEB/INSPECCIONES POR FECHA.html` (patrones),
`WEB/renova-office-shell.css`, `DESIGN.md`.

**No se modifican los navs de otras pantallas**: eso es `task_07`.

## 5. Contratos

`PLAN.md` §3 (experiencia, facetas, fila, estados), §4 (accesibilidad) y §5 (diseño).
`DECISIONES.md` D13 (input de filtro) y D14 (paleta de la barra).

## 6. Pasos

1. `servicios.html`: shell estándar — `renova-office-shell.css`, `buscador/buscador.css`,
   `shared/filter-bar.css`, `servicios/servicios.css`; header navy con brand y `nav` con
   `Servicios` en `class="active"` y `aria-current="page"`; `button.finder-trigger` con
   `aria-haspopup="dialog"` y `aria-keyshortcuts="Control+K Meta+K"`.
2. Montar el buscador global con el bloque estándar, idéntico al de `WEB/neumaticos.html:76`:
   promesa sobre `window.onRenovaSupabaseReady`, listener de click, y listener global de `Ctrl/Cmd+K`
   que **se ignora si el foco está en `input, textarea, select, [contenteditable='true']`**.
3. `servicios-controller.js`: estructura de `WEB/neumaticos/neumaticos-controller.js` — objeto
   `state`, objeto `elements`, un `render()` idempotente.
4. Montar `createFilterBar({ mount, facets: SERVICE_FACETS, rows, chips, onChange, onOpen })`.
   **Sin carga perezosa de catálogo**: el fetch único ya trae todas las filas, a diferencia de
   Inspecciones, que sí tiene un índice de facetas separado.
5. Chips ↔ URL: `onChange` → `history.pushState(..., searchForChips(chips))` → `render()`;
   `popstate` → `chipsFromSearch(location.search)` → `filterBar.setChips(...)` → `render()`.
   `setChips` no re-dispara `onChange`, igual que en Inspecciones.
6. Realtime: `RenovaSupabase.onDataChange(["tire_movement_executions"], recargar)`, con el debounce
   del patrón existente. Un servicio recién cerrado por un operario aparece sin recargar la página.
7. Pintar los 4 stat tiles, la barra segmentada con su leyenda, la lista y los 8 estados.
8. `servicios.css`: tokens de `renova-office-shell.css`, chaflán 8px en tiles, la paleta de D14,
   y el bloque `prefers-reduced-motion` al cierre.

## 7. Invariantes

- **Un solo `render()`.** Nada de renders parciales que puedan desincronizar el total del tile
  respecto de la lista visible. Un tablero que se contradice consigo mismo es peor que uno lento.
- **Ningún camino a una RPC** (D9). El controlador solo lee.
- **La fila no es clicable** (D5). Solo la placa y el código son enlaces.
- **`textContent` y creación DOM segura.** Nunca interpolar dato remoto en `innerHTML`.
- **Con `total === 0` los cuatro tiles muestran `—`, nunca `0`.** No distinguir «no hubo» de «no
  cargó» es un dato fingido (`DESIGN.md` §8, `reglas_negocio` §8).
- **Con `total === 0` no se pinta barra.** Nunca una barra vacía al 100 % de un color.
- **El único naranja persistente es el segmento `discard`** (D14, Regla del Naranja Único).
- **El color nunca es el único canal**: leyenda con conteo y porcentaje, `title` por segmento,
  `role="img"` + `aria-label` que enumera todo.
- Chaflán solo en stat tiles. **No** en inputs, filas ni chips (`DESIGN.md` §7).
- Sin sombras propias. Sin rojo. Sin torta, sin 3D.
- Deshabilitados por recolor a `field-dark`/`border-dark`, **nunca `opacity`**.
- `tabular-nums` en todo número; JetBrains Mono en todo.
- No modificar `WEB/servicios/{data.js,servicios-model.js}`: si falta una función, vuelve a
  `task_05` con su test.

## 8. Casos de error

Los 8 estados de `PLAN.md` §3.4. En particular:

- **Rol sin acceso ≠ sin datos.** `inspector` y `workshop_manager` no están en las policies
  (`AUDIT.md` §7). Detectarlo comparando el `role` del perfil contra los roles cubiertos **antes** de
  interpretar una lista vacía. Sin esto, esos usuarios reportarán un bug inexistente.
- **Truncado nunca silencioso** (D10): banner visible con el conteo y la instrucción de acotar.
- Filtros sin coincidencias ≠ sin datos: mensaje distinto, con acción para quitar el último chip.
- `casingHistoryHref` null: texto plano, nunca `<a href="null">`. Si hay código pero
  `!casing_exists`, mostrar el código + `SIN HISTORIAL` con `title` explicativo.
- `rotation_pairing='inferred'`: tag `ATRIBUCIÓN INFERIDA` con `title` que aclara que el total es
  correcto pero el pareo de esa fila es aproximado.
- `rotation_pairing='not_paired'`: `P{n} → ?`.

## 9. Aceptación

Smoke local servido por HTTP, con consola limpia:

1. La pantalla carga servicios reales y los cuenta.
2. Elegir dos valores de una faceta y uno de otra: OR dentro, AND entre. La URL refleja los chips.
3. Copiar la URL a una pestaña nueva: mismo estado. Atrás/Adelante restauran.
4. Quitar un chip actualiza tiles, barra y lista **a la vez**.
5. La barra suma exactamente 100.0 y su leyenda cuadra con los tiles.
6. Una fila de rotación muestra `P{n} → P{m}`.
7. Un código sin registrar se muestra sin enlace, con `SIN HISTORIAL`.
8. Clic en placa abre `Inspecciones por unidad.html?plate=…`; clic en código abre
   `historial-neumatico.html?serie=…&from=servicios`.
9. `Ctrl/Cmd+K` abre el buscador global; dentro del campo de filtro **no** lo captura.
10. Teclado completo en el filter-bar: flechas, `Home`/`End`, `Enter`, `Escape`, `Backspace`.
11. Viewports 390×844 y escritorio: sin overflow horizontal.
12. `prefers-reduced-motion: reduce`: los segmentos cambian sin transición.
13. Bajar `SERVICES_FETCH_LIMIT` a 5 temporalmente: aparece el banner. **Restaurar a 2000.**
14. Con datos vacíos simulados: cuatro `—`, sin barra, mensaje explícito.
15. Realtime: cerrar una orden en otra pestaña actualiza la lista sola.

`node --check` y `git diff --check` limpios. Suites de `task_05` siguen verdes.

## 10. Rollback

Borrar `WEB/servicios.html` y los dos archivos nuevos de `WEB/servicios/`. La pantalla aún no está
enlazada desde ninguna parte (eso es `task_07`), así que nada queda roto.

## 11. Handoff

Actualizar la fila 06 de `STATE.md` con el resultado de los 15 puntos, los viewports probados y
cualquier decisión visual que se haya tenido que tomar sobre la marcha.

**Registrar explícitamente si el tag `ATRIBUCIÓN INFERIDA` fue visible con datos reales** — el
resultado de la consulta 3 de `task_04` lo anticipa, pero conviene confirmarlo en pantalla.

`task_07` no toca esta pantalla: solo la enlaza desde las otras 8 y la mete en el bundle.
