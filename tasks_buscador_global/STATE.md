# STATE — Buscador global y objetos navegables

Estados: `PENDIENTE` · `EN CURSO` · `EN REVISIÓN` · `APROBADO` · `EN CORRECCIÓN` ·
`BLOQUEADA POR DECISIÓN HUMANA` · `N/A`.

Cada ejecutor actualiza solo su fila al iniciar y terminar. La autoridad sigue siendo el código,
el esquema y las pruebas; esta tabla es la bitácora.

| # | Título | Propietario | Estado | Depende de | Archivos exclusivos | Resultado/Revisión |
|---|---|---|---|---|---|---|
| 01 | Auditoría y contrato de datos | CLAUDE | APROBADO | — | Documentos iniciales de esta carpeta | Auditoría local cerrada; contrato congelado en `CONTRATOS_DATOS.md`. Pendiente reconfirmar evidencia remota al inicio de `task_02`. |
| 02 | Migración `v_search_index` | CLAUDE | APROBADO | 01 | `supabase/migrations/20260719120000_search_index_view.sql` | Lista para task_03, sin DDL remoto aplicado. Validación remota de la consulta equivalente: 40/40 cascos, 269/269 unidades, 0 duplicados; estados 38 installed / 1 in_inventory / 1 discarded; 23 code_mismatch con ambos códigos presentes. `sync-migration-reviewer`: APPROVE. |
| 03 | Aplicación remota y verificación | CLAUDE + USUARIO | APROBADO | 02 | Evidencia en esta tabla | Vista aplicada en `fbxupwwgiebhlciqftpw`. SQL: 269/269 unidades y 40/40 cascos, 0 duplicados, 0 status nulos/inválidos; grant solo `authenticated/SELECT`; anon REST = HTTP 401; 22 `code_mismatch` verificables, 0 sin ambos códigos. Payload total: 94,128 B (309 filas), proyección 500 U + 3,800 C ≈ 1.42 MiB. Dashboard local con `fetchView`: MÓVIL BUS 138 = SQL 138 (98 U, 40 C; 40,588 B) y CIVA 107 = SQL 107 (107 U; 29,640 B); cada sesión devolvió un solo tenant y los tenants fueron distintos. Sin truncado observado. |
| 04 | Módulo compartido de búsqueda | CODEX | APROBADO | 01 | `WEB/shared/search.js`, imports de `WEB/inventario/inventory-model.js` y `WEB/movimientos/inventory-ui.js` | Decisión humana aplicada: normalización común de Inventario; Movimientos conserva sus campos y UI. Las copias divergían solo en locale/diacríticos/espacios. Regresión sin modificar suites existentes: Inventario 15/15, Movimientos 166/166 y shared 4/4; `git diff --check` pasa. |
| 05 | Carga, caché de sesión y modelo puro | CODEX | APROBADO | 03, 04 | `WEB/buscador/{package.json,vitest.config.js,data.js,search-model.js,__tests__/*}` | 13/13 pruebas nuevas; regresión Inventario 15/15 y Movimientos 166/166. Caché versionada (`v1`) aislada por usuario autenticado y company_id RLS; prueba emite `SIGNED_OUT`, purga sessionStorage/memoria y fuerza refetch. Payload real de referencia por tenant: 40,588 B (MÓVIL BUS; task_03). |
| 06 | Overlay del buscador | CODEX | APROBADO | 05 | `WEB/buscador/finder-controller.js`, `WEB/buscador/buscador.css` | Smoke HTTP aislado con mocks: combobox/listbox, grupos 1 unidad + 2 neumáticos, casco sin código no navegable, Home/End/flechas/Enter/Escape y foco restaurado; loading/empty/unauthorized/error/retry/stale. Viewports 780×437 y 390×844 sin overflow; reduced motion = `0s`; 0 errores de consola; `node --check` y `git diff --check` pasan. Sin integración global: queda para task_07. |
| 07 | Puntos de entrada y objetos navegables | CODEX | APROBADO | 06 | `WEB/renova-office-shell.css`, enlaces de los HTML enumerados en `task_07`, bundle estático | Smoke local: las 7 pantallas tienen barra, botón y Ctrl/Cmd+K; Instalación no captura el atajo dentro de un campo. `?date=`, `?plate=`, `?inspection_id=`, `?mode=movimientos`, alias `?mode=cambios` (canonicaliza a movimientos) y `?tab=descartados` siguen resolviendo. Historial: fallback real para inspección/rendimiento/inventario/instalación/buscador/sin origen; Instalación enlaza código no nulo y muestra `—` sin enlace para nulo. Bundle contiene `buscador/` y `shared/`. Hallazgo preexistente, no corregido: allowlist aún omite `renova-animate.js` y `renova-format.js`. |
| 08 | Suite integral y smoke autenticado | CODEX + USUARIO | APROBADO | 07 | Evidencia local; `PRUEBA_CAMPO.md` | **Repetido 2026-07-19 tras task_10-13** (obligatorio por el cambio en `finder-controller.js`/`search-model.js`/`data.js`/pantalla nueva). Suite sobre el estado final: shared 4/4, buscador 18/18, neumaticos 3/3, Inventario 15/15, Movimientos 166/166 (sin tocar sus `__tests__/`); bundle con `buscador/`, `shared/`, `neumaticos/` y `neumaticos.html`; `git diff --check` y `npm run docs:check` correctos. Smoke de campo original (empresa A 98/98 U + 40/40 C, empresa B 107/107 U + 0/0 C, aislamiento A→B confirmado, `code_mismatch` por ambos códigos, 3 cascos sin código sin enlace falso) sigue vigente como evidencia numérica — ver `PRUEBA_CAMPO.md`. La persona responsable repitió el recorrido de campo (19 puntos: los 15 originales más overlay centrado, frecency persistida/purgada, chips `uni:`/`neu:` y facetas+URL compartible+atrás de `neumaticos.html`) y confirmó que todos pasan, sin volver a disgregar conteos por empresa en esta repetición (detalle y esa salvedad en `PRUEBA_CAMPO.md`). Sin caso real sin código/sin unidad (N/A, sin crear datos). |
| 09 | Documentación, ADR y revisión cruzada | CLAUDE | APROBADO | 08 | `REVISION_FINAL.md`, ADR en `decisions/`, knowledge enumerado en `task_09`, columna Revisión de esta tabla | `decisions/0005-buscador-global-objetos-navegables.md` creado: dos objetos navegables, índice cliente, sin parsing silencioso, enruta-no-ejecuta, Command Palette descartada, limitación de cascos sin código. Knowledge actualizado: `07` (superficies + sección Buscador global), `05` (`v_search_index` como vista de lectura desde tablas base), `09` (overlay como patrón, Naranja Único, `a11y.js`), `10` (las 5 deudas de `task_09` §6), `12` (ADR-0005 indexado). `REVISION_FINAL.md` separa evidencia local de campo y registra deuda/pendiente sin ocultarlos. `npm run docs:check` verde. |
| 10 | Overlay centrado y persistencia de frecency | CODEX | APROBADO | 07 | `WEB/buscador/{finder-controller.js,buscador.css,data.js}`, `WEB/renova-office-shell.css` y los 7 HTML de entrada | Frecency `v1` persiste en localStorage, aislada por `user_id` + `company_id`, máxima 100 entradas/90 días y purgada en SIGNED_OUT/SIGNED_IN/USER_UPDATED; fallback de memoria si storage falla. Sin historial muestra mensaje honesto. Corrección de integración autorizada: los 7 HTML ahora enlazan `buscador/buscador.css`. Smoke real: `position: fixed`, Spotlight en tercio superior (70 px), 390×844 sin overflow; bundle contiene CSS. Buscador 16/16, Inventario 15/15, Movimientos 166/166; node check y diff correctos. |
| 11 | Prefijos de alcance por tipo | CODEX | APROBADO | 10 | `WEB/buscador/{search-model.js,finder-controller.js,buscador.css,__tests__/search-model.test.js}` | D16 listo: `uni:`/`neu:` se materializan como chip removible y acotan solo `kind`; D8 no fue derogada ni se infieren atributos. Modelo cubre mayúsculas, desconocidos, posición media y doble prefijo. Smoke 390×844: ambos alcances, Backspace y retorno global correctos, sin overflow ni errores. Buscador 18/18, Inventario 15/15 y Movimientos 166/166; `node --check` y diff correctos. |
| 12 | Extensión de facetas en `v_search_index` | CLAUDE + USUARIO | APROBADO | 11 | `supabase/migrations/20260719180841_search_index_facets.sql` | D18 aplicada y registrada en `fbxupwwgiebhlciqftpw`. **`sync-migration-reviewer`: APPROVE (retrospectivo, 2026-07-19)** — 10 columnas previas conservan orden/tipo idéntico en ambas ramas del `union all`, 5 facetas agregadas estrictamente al final, `security_invoker=true` y grant solo `authenticated/SELECT` intactos (sin `anon`), los joins a `tire_life_cycles`/`tire_installations`/`inspections`/`inspection_measurements` ya existían en la migración base y no amplían superficie RLS, cambio aditivo puro sin tocar otras vistas/tablas/RPC/policy, riesgo bajo. Reconfirmado en esta sesión: conteos 269 U + 40 C sin mover; facetas nulas solo en unidades (0 unidades con faceta no nula); grants = solo `authenticated/SELECT`; RLS de las 6 tablas base = `select_own_company` filtrando por `current_company_id()`, ninguna sin RLS. Inventario de marcas real: MICHELIN 25, QA-TEST 9, MARSHAL 6 (deuda de datos, no defecto del buscador). Payload JSON (proxy `to_jsonb`, no fetch real por HTTP): 125,756 B/309 filas vs. 94,128 B baseline sin facetas (+33.6%); proyección estimada 500 U + 3,800 C ≈ 2.25 MiB (era ≈1.42 MiB). Advisors de Supabase: solo advertencias preexistentes ajenas a `v_search_index` (RPCs `SECURITY DEFINER` de otras fases, `leaked_password_protection`, `btree_gist` en `public`). |
| 13 | Pantalla de Neumáticos por faceta | CODEX | APROBADO | 12 | `WEB/neumaticos.html`, `WEB/neumaticos/*`, enrutado en `finder-controller.js`, allowlist del bundle | D17 listo: una pantalla de solo lectura reutiliza el índice v2, facetas URL AND con `pushState`, chips removibles y opciones derivadas del índice. El buscador ofrece enlace explícito por marca/medida/condición. Smoke 390×844: 3 facetas→1 casco, URL compartida conserva resultado, Atrás revierte un filtro, chip actualiza URL, casco sin código visible/no navegable, sin overflow ni errores. Neumáticos 3/3, Buscador 18/18, Inventario 15/15, Movimientos 166/166; bundle y diff correctos. |

## Orden de ejecución

Los números son etiquetas; la verdad es la columna «Depende de». Secuencia real:

```text
01 → 02 → 03 → 04 → 05 → 06 → 07 → 10 → 11 → 12 → 13 → 08 → 09
```

Las tareas 10–13 nacen de la revisión humana de `task_07` (2026-07-19) y se insertan **antes** del
cierre. `task_08` (suite y smoke integral) y `task_09` (docs, ADR y revisión) cierran la fase
completa, incluyendo lo agregado.

`task_07` permanece `APROBADO`: las tareas nuevas corrigen encima en vez de reescribir una tarea ya
cerrada, para no perder el rastro de qué se aprobó y cuándo.

**`task_08` se ejecutó anticipadamente sobre el estado de `task_07`.** Su evidencia es válida para
ese código, no para el de `task_13`. Las tareas 10–13 modifican `finder-controller.js`,
`search-model.js`, `v_search_index` y agregan una pantalla, así que **`task_08` debe repetirse tras
`task_13`** antes de que `task_09` cierre la fase. La corrida actual queda como evidencia
intermedia, no como cierre.

## Reglas de bloqueo

1. Si `task_03` encuentra respuesta truncada por `max-rows` o conteo del índice distinto de
   `count(*)` de `units`/`tire_casings`, pasa a `BLOQUEADA POR DECISIÓN HUMANA`. Un truncado
   silencioso no se acepta como límite tolerado.
2. Si `task_04` necesita modificar las suites existentes de Inventario o Movimientos para que pasen,
   la extracción cambió comportamiento: pasa a `EN CORRECCIÓN`. **No se ajustan los tests.**
3. Si el esquema real contradice `CONTRATOS_DATOS.md` —en particular si el camino
   `tire_casings → … → inspection_measurements` no permite recuperar el `tire_code` de la última
   medición— la fase se detiene y se abre una fase de esquema separada. No se degrada el `haystack`
   en silencio.
4. Si la caché sobrevive a un cambio de empresa en cualquier prueba, `task_05` vuelve a
   `EN CORRECCIÓN` sin excepción: es una fuga entre inquilinos.
