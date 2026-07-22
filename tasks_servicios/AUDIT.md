# AUDIT — Sección Servicios (consulta y métricas de servicios ejecutados)

Fecha: 2026-07-20. Auditoría previa a decidir. Autoridad: migraciones, código y pruebas actuales.

## 1. Reencuadre del pedido

La petición humana fue: «establecer la lógica de los servicios, tipos de servicio (ya definidos
parcialmente en movimientos), crear nueva sección para lo de servicios, saber cuántos servicios se
hacen y de qué tipos, como un buscador similar al de inspecciones pero para servicios».

El reencuadre tras auditar: **la lógica de servicios no falta, falta la superficie de lectura.**

- El ciclo orden → ejecución ya existe, está aplicado y funciona.
- Los tipos de servicio ya están definidos como enum en la base; no hay nada que inventar.
- Lo que no existe es **ninguna vista sobre `tire_movement_executions`**, y por tanto ninguna forma
  de responder «cuántos servicios se hicieron y de qué tipo».

El trabajo es una capa de consulta. No agrega escritura ni cambia el ciclo operativo.

## 2. El ciclo implementado

Definido en `supabase/migrations/20260720012248_operator_movement_orders.sql` (494 líneas) y
extendido en `20260720022451_movement_order_fleet_manager_compatibility.sql`.

```text
Supervisor (WEB, modo movimientos de "Inspecciones por unidad.html")
  └─ create_tire_movement_order(p_order_id, p_unit_id, p_scheduled_for, p_instructions, p_items)
       └─ tire_movement_orders  (status='issued', request_items jsonb)
             │
Operario ("app movimientos/", React + Capacitor)
  ├─ claim_tire_movement_order(p_order_id)        issued → in_progress
  └─ complete_tire_movement_order(p_order_id, p_odometer_km, p_items)
       ├─ in_progress → completed
       ├─ inserta N filas en tire_movement_executions (sequence 1..N)
       └─ units.last_odometer := greatest(...)
```

Estados: enum `tire_movement_order_status` = `issued | in_progress | completed | cancelled`.
`cancelled` está declarado pero **ningún código lo escribe**: no hay RPC de cancelación.

Las tres RPCs son `security definer`. Toda escritura pasa por ellas; las policies de las dos tablas
son **solo `SELECT`**.

## 3. El hueco

| Superficie | Existe |
|---|---|
| Vista de cabeceras de orden | Sí — `v_operator_movement_orders` (`security_invoker=true`) |
| Vista de ejecuciones | **No** |
| Vista agregada de servicios | **No** |

`WEB/movimientos/data.js:163` (`loadMovementExecutions`) lee `tire_movement_executions` **directo con
`select` explícito y `limit 300`**, filtrando por `order_id`. Sirve para pintar una orden concreta;
no sirve como base de métricas de flota.

Consecuencia: no existe ni una consulta ni una pantalla que responda la pregunta del pedido.

## 4. Tipos de servicio: qué hay realmente

Fuente canónica: enum `public.tire_movement_reason`
(`20260720012248_operator_movement_orders.sql:22`), 7 valores.

| Valor | `MOVEMENT_REASONS` (web) | `SHORT_REASON` (proyección) | `REASON_LABELS` (app) |
|---|---|---|---|
| `repair` | PARA REPARACIÓN | A REPARACIÓN | PARA REPARACIÓN |
| `retention` | PARA RETÉN | A RETÉN | PARA RETÉN |
| `claim` | PARA RECLAMO | A RECLAMO | PARA RECLAMO |
| `rotation` | ROTACIÓN / INTERCAMBIO | ROTACIÓN | ROTACIÓN |
| `discard` | PARA SCRAP | A SCRAP | PARA SCRAP |
| `retread` | REENCAUCHE | A REENCAUCHE | REENCAUCHE |
| `balancing` | BALANCEO | A BALANCEO | BALANCEO |

**Tres glosarios paralelos** para un mismo enum (`WEB/movimientos/supervisor-order-model.js:1`,
`WEB/movimientos/supervisor-order-projection.js`, `app movimientos/src/lib/model.ts`). Difieren solo
en `rotation`. La fase nueva **no crea un cuarto**: reutiliza `MOVEMENT_REASONS`.

Catálogo legado que **no** hay que confundir: enum `removal_reason`
(`20260706120000_demo_vertical_slice.sql:50`) = `retread, rotation, retention, discard, other`. No
comparte valores con `tire_movement_reason` (`repair`/`claim`/`balancing` no existen ahí; `other` no
existe en el nuevo). No mezclarlos en ninguna agregación.

## 5. Las dos trampas de conteo

### 5.1 El motivo solo existe en salidas

Constraint `tire_movement_executions_reason_by_direction`: `direction='exit'` **exige**
`movement_reason not null`; `direction='entry'` lo **prohíbe**.

Consecuencia dura: **un ingreso no tiene tipo de servicio.** Cualquier métrica «por tipo» calculada
de frente cuenta solo salidas, y las instalaciones quedan invisibles. Es una decisión de producto,
no un detalle técnico.

### 5.2 Una rotación son dos renglones

`WEB/movimientos/supervisor-order-model.js:130` (`addRotation`) empuja **siempre dos ítems
adyacentes**:

```js
normalizeItem({ direction: "exit",  position: source, reason: "rotation", notes }),
normalizeItem({ direction: "entry", position: target,
                notes: `Rotar desde P${source}…` }),
```

Contar renglones suma doble toda rotación. Un tablero que diga «se hicieron 40 servicios» cuando
fueron 30 es peor que no tener tablero.

## 6. Hallazgo central: el pareo por posición estructural es fiable

La pregunta que decide toda la fase: **¿se puede saber, en la base, qué ingreso cierra qué rotación?**

Cadena verificada renglón a renglón:

1. `WEB/movimientos/supervisor-order-model.js:138-146` — `addRotation` emite el par siempre
   adyacente y en ese orden dentro de `draft.items`, que se serializa a `request_items`.
2. `app movimientos/src/lib/model.ts:49` — `draftFromOrder` hace
   `order.request_items.map(newExecutionItem)`. Mapeo **1:1 y en orden**.
3. `app movimientos/src/screens/ExecutionScreen.tsx:53` — la única mutación es
   `current.items.map((item, itemIndex) => itemIndex === index ? {...item, ...patch} : item)`.
   **No hay `push`, `splice`, `filter` ni `concat`.** El operario edita campos, no la lista.
4. `20260720012248_operator_movement_orders.sql:346,385-386` — `v_sequence smallint := 0`, y dentro
   del `for v_item in select value from jsonb_array_elements(p_items) loop` hace
   `v_sequence := v_sequence + 1` **antes** de insertar.

⇒ El primer ítem se guarda con `sequence = 1`, y por tanto:

> **`tire_movement_executions.sequence - 1` es el índice 0-based exacto dentro de
> `tire_movement_orders.request_items`.**

Ese es el pareo robusto, y es la base de `CONTRATOS_DATOS.md` §2.

**Descartado explícitamente: emparejar por texto.** `newExecutionItem` inicializa `observations` con
`request.notes` (que contiene «Rotar desde P3»), pero el operario lo edita libremente en la pantalla
de ejecución. Un pareo por prosa se rompe el primer día que alguien escriba una observación.

### 6.1 El riesgo que obliga a dos niveles

`complete_tire_movement_order` **no valida** `jsonb_array_length(p_items) = jsonb_array_length(v_order.request_items)`.
Solo valida que `p_items` sea un array no vacío (línea 381). Una versión futura de la app que
agregue o quite renglones rompería la alineación **en silencio**.

Por eso la vista lleva dos niveles (exacto e inferido-con-tope) y expone cuál aplicó en
`rotation_pairing`. El nivel 2 preserva el **invariante de conteo** aunque la atribución por fila sea
aproximada. Sin esa columna la vista sería una caja negra que no se puede auditar.

*Mitigación real, fuera de esta fase:* añadir `request_item_index smallint` que la RPC escriba
explícitamente. Convierte una propiedad emergente del cliente en un dato de la base. Toca la RPC, así
que no cabe en una fase de lectura.

## 7. Cobertura de roles

Las policies `select_movement_orders_own_company` y `select_movement_executions_own_company`,
redefinidas en `20260720022451`, cubren:

`tire_supervisor` · `fleet_manager` · `operator` · `admin`

**`inspector` y `workshop_manager` no ven ninguna fila.** Con `security_invoker=true` eso es
correcto, pero la pantalla debe distinguir «tu rol no tiene acceso» de «no hay datos». Si no, un
inspector reportará un bug que no existe.

## 8. Deuda de datos que afecta agregaciones

Heredada de fases anteriores, registrada en `knowledge/ai/10` y `tasks_buscador_global/AUDIT.md`:

| Deuda | Efecto sobre esta fase |
|---|---|
| `brand_name` con variantes de caja (`GOODYEAR`/`goodyear`) | **Parte agregaciones en filas separadas.** No afecta búsqueda, sí conteos. Se resuelve normalizando en SQL (`brand_key`). |
| `QA-TEST` en producción (9 cascos, 14 mediciones, unidad `QA-CN16`) | Contamina cualquier conteo. **No se filtra**: ver `DECISIONES.md` D8. |
| ~316 cascos sin `code` | Sin historial alcanzable. No fabricar enlaces falsos. |
| `reconciliation_status` = `pending` en el 100 % de los renglones | **No existe reconciliador.** Los servicios no ligan a `tire_casings`/`tire_life_cycles`/`tire_installations`. La pantalla mide actividad declarada por personas, no ciclos de vida. |
| Antipatrón `limit: '200'` sin aviso (`instalacion.html`) | No repetirlo: el límite debe ser visible. |

Escala objetivo para dimensionar: ~500 unidades / ~3 800 neumáticos, no los ~40 cascos actuales.

## 9. Superficies web y su navegación

8 HTML autocontenidos, sin framework, bundler ni router. La navegación está **duplicada a mano** y
**no es uniforme**:

| Archivo | Línea | Clase | Nota |
|---|---|---|---|
| `WEB/INSPECCIONES POR FECHA.html` | 244 | `screen-nav` | |
| `WEB/rendimiento.html` | 377 | `screen-nav` | |
| `WEB/historial-neumatico.html` | 152 | `screen-nav` | no marca ninguno activo |
| `WEB/importar.html` | 163 | `screen-nav` | |
| `WEB/inventario.html` | 25 | `nav` | sin enlace a Neumáticos |
| `WEB/neumaticos.html` | 25 | `nav` | sin enlace a Importar |
| `WEB/instalacion.html` | 171 | `nav` | |
| `WEB/Inspecciones por unidad.html` | 446 | `a.chip` | variante propia en `.hdr-right` |

`renova-office-shell.css:68` estiliza `nav` y `screen-nav` idénticos. Unificar esto es deuda
registrada; **no se hace en esta fase** (ver `DECISIONES.md` D12).

`scripts/prepare-static-hosting.mjs` tiene dos allowlists (archivos HTML y directorios de módulos).
Una página nueva necesita **ambas**; con solo la primera, la página se despliega y sus módulos dan 404.

## 10. Primitivas reutilizables

La fase no crea ninguna primitiva nueva. Todo existe:

| Necesidad | Módulo existente |
|---|---|
| Filtro facetado | `WEB/shared/filter-bar.js` (`createFilterBar`), `WEB/shared/filter-facets.js` (`applyFilters`, `distinctValues`) |
| Normalización y tokens | `WEB/shared/search.js` (`normalizeSearchText`, `filterRowsBySearchTokens`) |
| Facetas de fecha y mes | `WEB/shared/inspection-date-facets.js` — **parametrizable por columna**, se reutiliza con `captured_on` |
| Chips en URL | patrón de `WEB/INSPECCIONES POR FECHA.html:642-800` (`chipsFromLocation`/`urlForChips` + `pushState`/`popstate`) |
| Buscador global | `WEB/buscador/finder-controller.js` (`createFinderController`) + bloque de montaje estándar |
| Lectura de vistas | `RenovaSupabase.fetchView(name, params)` en `WEB/supabase-demo.js` |
| Estructura de módulo | `WEB/neumaticos/` y `WEB/buscador/` (datos / modelo puro / controlador DOM + `__tests__/`) |
| Helper de red inyectable | `getFetchView(dependency)` en `WEB/movimientos/data.js:68` |

## 11. Ausencia de convención de zona horaria

`grep "at time zone"` sobre `supabase/migrations/` → **0 resultados**. El proyecto nunca tuvo que
agrupar `timestamptz` por día.

`captured_at` es `timestamptz`. Sin conversión explícita, `::date` se resuelve en UTC y un servicio
capturado a las 20:00 en Lima se agrupa **al día siguiente**. Es una decisión nueva, no un detalle de
implementación: ver `DECISIONES.md` D11.

## 12. Restricción de arquitectura heredada

`decisions/0005-buscador-global-objetos-navegables.md` fija: **solo Unidad y Neumático son objetos
navegables**; las facetas resuelven a listas filtradas, nunca a páginas propias.

Servicios como **lista filtrable que enruta hacia esos dos objetos** respeta la decisión.
Servicios como tercer objeto del buscador global (`servicio.html?id=`, `kind:'service'` en
`v_search_index`) la contradice y exigiría un ADR que la derogue. No se hace: ver `DECISIONES.md` D5.

## 13. Conclusión

El pedido es implementable sin cambiar el ciclo operativo ni el esquema de escritura. Requiere:

1. **una** migración aditiva de lectura (`v_tire_services`) que materialice la definición de servicio
   y resuelva el pareo de rotación;
2. una pantalla de solo lectura que reutilice las primitivas de filtrado existentes;
3. registrar la definición de servicio como ADR, porque es una regla de negocio que se re-litiga.

El riesgo mayor no es técnico sino de contrato: si «servicio» se define mal, todo reporte futuro
hereda el error. Por eso `CONTRATOS_DATOS.md` se congela antes de escribir SQL.
