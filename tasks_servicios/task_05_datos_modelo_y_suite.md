# task_05 — Capa de datos, modelo puro y suite

## 1. Propietario

**CODEX.**

## 2. Objetivo y resultado observable

Los dos módulos sin DOM de la pantalla, con su suite Vitest verde: `data.js` (única capa de red) y
`servicios-model.js` (facetas, filtrado, resumen y enlaces, todo puro).

Al terminar, la lógica de la pantalla es testeable sin navegador y sin red.

## 3. Dependencias y bloqueos

Depende de `task_04`. Bloquea `task_06`.

## 4. Archivos exclusivos

- `WEB/servicios/package.json`
- `WEB/servicios/vitest.config.js`
- `WEB/servicios/data.js`
- `WEB/servicios/servicios-model.js`
- `WEB/servicios/__tests__/data.test.js`
- `WEB/servicios/__tests__/servicios-model.test.js`

Solo lectura: `WEB/buscador/` y `WEB/neumaticos/` (patrón), `WEB/shared/*`,
`WEB/movimientos/{data.js,supervisor-order-model.js}`, `WEB/supabase-demo.js`, `CONTRATOS_DATOS.md`.

## 5. Contratos

`CONTRATOS_DATOS.md` §3 (columnas), §6 (consumo) y §7 (casos de error).
`PLAN.md` §3.2 (facetas) y §7 (pruebas).

## 6. Pasos

1. Copiar `package.json` y `vitest.config.js` de `WEB/buscador/` sin cambios sustantivos
   (`"test": "../movimientos/node_modules/.bin/vitest run"`, `environment: "node"`,
   `include: ["__tests__/**/*.test.js"]`). **No instalar vitest de nuevo**: se reutiliza el de
   `WEB/movimientos/node_modules`.
2. `data.js`: reutilizar el helper inyectable `getFetchView(dependency)` de
   `WEB/movimientos/data.js:68`, que cae a `globalThis.RenovaSupabase` y permite mockear en tests.
3. Exportar `SERVICES_FETCH_LIMIT = 2000` y
   `loadServices({ limit } = {}, dependency) → {rows, limit, truncated}`.
4. `servicios-model.js`: definir los 8 tipos en orden canónico, sus etiquetas y sus tonos.
   **Reutilizar `MOVEMENT_REASONS`** de `WEB/movimientos/supervisor-order-model.js` — no escribir un
   cuarto glosario (límite 7 del orquestador). `installation` toma `INSTALACIÓN`, coherente con
   `supervisor-orders-ui.js`.
5. Definir `SERVICE_FACETS` con el contrato de `WEB/shared/filter-facets.js`
   (`{key, label, values(rows), match(row, value)}`), las 12 de `PLAN.md` §3.2.
6. `chipsFromSearch` / `searchForChips` siguiendo el patrón de
   `WEB/INSPECCIONES POR FECHA.html` (`searchParams.append` repetido = OR).
7. `filterServices` = `filterRowsBySearchTokens(applyFilters(rows, chips, SERVICE_FACETS), query, SEARCHABLE)`.
8. `summarizeServices` y `segmentsFromSummary`.
9. `unitHref` y `casingHistoryHref` con el mismo formato que `WEB/buscador/search-model.js` y
   `WEB/neumaticos/neumaticos-model.js`.
10. Escribir la suite de §9.

## 7. Invariantes

- **`data.js` nunca envía `company_id`** (límite 4 del orquestador).
- **`data.js` nunca usa `select: "*"`**: lista explícita de columnas.
- **`truncated` no se puede olvidar.** Es la salvaguarda de D10; tiene test propio.
- `servicios-model.js` es **puro**: sin `document`, sin `window`, sin `fetch`, sin `localStorage`.
- **`summarizeServices([])` devuelve `{total:0, firstDate:null, byType:[]}`.** El modelo nunca decide
  mostrar `—`; eso es del controlador. Así el contrato de «sin datos» se testea sin DOM.
- `segmentsFromSummary` **nunca emite un segmento con `count === 0`**.
- Los porcentajes suman exactamente 100.0: el segmento mayor absorbe el residuo del redondeo, para
  que la barra no deje un hueco de 0,1 %.
- `casingHistoryHref` devuelve `null` si `code_unreadable`, si falta código, o si `!casing_exists`.
  **Nunca fabricar un enlace a una pantalla vacía.**
- No se modifica ningún archivo de `WEB/shared/`, `WEB/movimientos/`, `WEB/inventario/`,
  `WEB/buscador/` ni `WEB/neumaticos/`.

## 8. Casos de error

- Fila con `plate` con espacios o `/`: `unitHref` debe codificar con `encodeURIComponent`.
- Chip de una faceta que ya no existe (URL vieja guardada en favoritos): se ignora **sin lanzar**.
- `rows` vacío, `null` o `undefined`: `filterServices` y `summarizeServices` no lanzan.
- Fila con `brand_key` null (marca no capturada): la faceta no la ofrece, la fila no desaparece.
- Un solo tipo presente: el único segmento es 100.0, no 99.9.

## 9. Aceptación

`cd WEB/servicios && npm test` verde, con al menos estos casos:

**`servicios-model.test.js`**

| Test | Qué prueba |
|---|---|
| rotación con `pair_position_number` cuenta 1 y no genera instalación | la regla de negocio central |
| `entry` con `service_type='installation'` cuenta como instalación | tipo sintético |
| `summarizeServices([])` → `{total:0, firstDate:null, byType:[]}` | contrato de «sin datos» |
| porcentajes suman exactamente 100.0 con 3 y con 7 tipos | corrección de redondeo |
| nunca se emite segmento con `count===0` | no pintar categorías vacías |
| **exactamente un** tipo tiene tono `alert` | **Naranja Único verificable en suite** |
| todo tipo tiene etiqueta y tono | no hay tipo sin color ni nombre |
| facetas `tipo`/`unidad`/`marca`/`mes` filtran correctamente | contrato con `applyFilters` |
| chip de faceta desconocida se ignora sin lanzar | robustez ante URL vieja |
| `chipsFromSearch(searchForChips(x))` idempotente, con multivalor | ida y vuelta de URL |
| `casingHistoryHref` → `null` con `casing_exists:false` | no fabricar enlaces falsos |
| `casingHistoryHref` → `null` con `code_unreadable:true` | |
| `casingHistoryHref` → string con ambos correctos | |
| `unitHref` codifica placas con espacios y `/` | |
| `filterServices` combina chips AND-entre-facetas con búsqueda por tokens | integración de capas |

**`data.test.js`**

| Test | Qué prueba |
|---|---|
| llama `fetchView("v_tire_services", …)` con `select`/`order`/`limit` exactos | contrato de lectura |
| **no** envía ningún parámetro `company_id` | RLS es la única frontera |
| `truncated === true` cuando devuelve exactamente `limit` filas | el aviso no se puede olvidar |
| `truncated === false` con menos filas | |
| lanza si no hay `fetchView` inyectable ni global | mismo comportamiento que `movimientos/data.js` |

**Regresión obligatoria, sin modificar ninguna suite**: `WEB/shared/`, `WEB/movimientos/`,
`WEB/inventario/`, `WEB/buscador/`, `WEB/neumaticos/`. Registrar los conteos.

`node --check` sobre los módulos nuevos y `git diff --check` limpios.

## 10. Rollback

Borrar `WEB/servicios/`. Ningún archivo existente fue modificado, así que no hay nada que revertir
fuera de la carpeta.

## 11. Handoff

Actualizar la fila 05 de `STATE.md` con los conteos de la suite nueva y de **cada** suite de
regresión.

Si alguna suite existente necesitó modificarse para pasar, **detener**: regla de bloqueo 5 de
`STATE.md`. No se ajustan los tests.

`task_06` consume estos módulos sin modificarlos. Si el controlador necesita una función que no está
aquí, se agrega aquí con su test, no se improvisa en el controlador.
