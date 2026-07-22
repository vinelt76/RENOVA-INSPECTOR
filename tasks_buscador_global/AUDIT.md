# AUDIT — Buscador global y objetos navegables

Fecha: 2026-07-19. Auditoría local sobre `WEB/`, `supabase/migrations/` y `knowledge/`.
Sin consulta remota nueva: la evidencia remota se toma de `tasks_cambios_neumaticos/BASELINE_REMOTO.md`
y `tasks_puesta_en_marcha_movimientos/STATE.md`, y debe reconfirmarse en `task_01`.

## 1. Petición humana y reencuadre

La petición original planteaba una Command Palette como método principal de interacción, con el
supuesto de que la web sufre exceso de dropdowns. La auditoría **contradice ese supuesto** y el
alcance se reencuadró con el humano.

Superficie total de filtrado en toda la web hoy:

- 4 selects: `dateSelect` (`INSPECCIONES POR FECHA.html`), `unitSelect` (`rendimiento.html`),
  `unitSelect` y `positionSelect` (`instalacion.html`).
- 2 cajas de búsqueda: `#inventory-search` (`WEB/inventario.html`) y el `input[type=search]` creado
  en `WEB/movimientos/inventory-ui.js:126`.
- 3 grupos de tabs/chips.

No existe un solo `ilike`, `like`, `fts` ni `or` en `WEB/`. Todos los filtros servidor son `eq.`
exacto. Los filtros que la petición atribuía a Inspecciones y Rendimiento (Estado, Condición, Marca,
Medida, Anomalía, Reencauche) **no existen**.

Conclusión: el problema no es exceso de filtros sino **ausencia de puntos de entrada y de objetos
navegables**.

## 2. Dolor real, ya documentado

`docs/dashboard_ui_ux_audit.md` lo registra con citas:

| Hallazgo | Referencia |
|---|---|
| «Ninguna página tiene buscador de placa» | §C:182-192 |
| Selección de unidad con 3 mecanismos distintos según pantalla | :166-169 |
| `historial-neumatico.html` solo alcanzable por deep-link; sin `<nav>` ni buscador | :170-176 |
| Su botón «Volver» apunta a `UI/renova_dashboard_taller_v1.html`, archivo inexistente | :414-419, severidad Alta |
| `instalacion.html` no enlaza a historial desde ninguna fila; descubrimiento unidireccional | :190-192 |
| `instalacion.html` no recuerda filtros tras recargar | :399-400 |
| Buscador/autocomplete de placa priorizado, nunca descartado, «requiere decisión de producto» | §G.5:635-639 |

Verificado adicionalmente: `Inspecciones por unidad.html` —la pantalla de detalle más importante—
**no está en la barra de navegación de ninguna página**.

Advertencia de método: toda esta evidencia es **estructural** (auditoría de código). No hay
telemetría, ni observación de usuarios reales, ni medición de clics. Nadie ha observado a un jefe de
flota usando el sistema.

## 3. Arquitectura web vigente

- 8 documentos HTML estáticos autocontenidos. Sin framework, sin bundler, sin router, sin SPA.
  Cada navegación recarga entera. No hay estado compartido entre pantallas.
- Nav horizontal de 5 links **duplicada a mano en 6 archivos**, con markup divergente
  (`.screen-nav` vs `.chip`). Dos pantallas quedan fuera de ella.
- Capa de datos: `WEB/supabase-demo.js:20-36`, `RenovaSupabase.fetchView(name, params)` — `fetch`
  crudo a `/rest/v1/<vista>` con querystring PostgREST. No usa el query builder.
- Toda lectura va contra **vistas**, nunca tablas. Escritura solo por RPC.
- Realtime: `onDataChange(tables, cb)` con debounce 400 ms → **re-fetch completo** de la pantalla.
- Shell compartido: `WEB/renova-office-shell.css` (header sticky navy, `.nav`/`.screen-nav`).

## 4. Precedentes reutilizables

Dos primitivas ya existen, correctas y probadas. **Ninguna debe reinventarse.**

1. **Búsqueda normalizada y tokenizada** — `WEB/inventario/inventory-model.js`:
   `normalizeSearchText()` (NFD + strip de diacríticos + `toLocaleLowerCase("es")` + colapso de
   espacios) y filtrado por tokens con AND, donde cada token puede coincidir en columna distinta.
   `SEARCHABLE_COLUMNS` (líneas 6-17) define el vocabulario ya considerado buscable.
   Tests en `WEB/inventario/__tests__/inventory-model.test.js`.
   **Está duplicada** en `WEB/movimientos/inventory-ui.js` con tests propios en
   `WEB/movimientos/__tests__/inventory-ui.test.js`.

2. **Overlay accesible** — `WEB/movimientos/a11y.js`: `createFocusTrap` y `aria-live` reales. La
   auditoría lo señala como «el estándar de accesibilidad a replicar en el resto del dashboard, no a
   bajar» (:359-363) y recomienda explícitamente reutilizarlo (:610-612). Ya coexisten dos sistemas
   de modal sin código compartido; un tercero sería deuda.

## 5. Modelo de datos relevante

### 5.1 Identidad fragmentada del neumático

La identidad vive en tres capas y **puede discrepar por diseño**:

- `tire_casings.code` — **nullable**, único por `(company_id, code)`.
- `inspection_measurements.tire_code` — texto que el inspector realmente teclea.
- `v_unit_position_state` expone `code_mismatch` justamente para señalar la discrepancia.

Consecuencia directa para el índice: indexar solo una fuente hace que un neumático aparezca o no
según por dónde se lo busque. **Ambas deben entrar al `haystack`.**

### 5.2 Sin catálogos

`brand_name`, `model_name`, `size_name`, `retread_design` son **texto libre denormalizado**,
duplicado en `tire_casings` y en `inspection_measurements`, sin FK ni tabla de catálogo. Las tablas
`catalog_models` existen en `supabase/schema_draft.sql` pero **nunca se migraron** (la migración base
lo declara: «Catálogo normalizado = Run 3», Run 3 no llegó).

Esto es lo que hace inviable un parser de prosa a filtros, y a la vez es **tolerable para un
índice de búsqueda por fragmento**: `miche` encuentra `Michelin`, `MICHELIN` y `michellin` por igual.

#### Medición real (2026-07-19, consulta de solo lectura al proyecto productivo)

La suciedad esperada resultó **menor y de un solo tipo**:

- **`size_name`: limpio.** Dos valores, formato canónico sin espacio, idénticos en `tire_casings` e
  `inspection_measurements`: `315/80R22.5` y `295/80R22.5`. La hipótesis de formato inconsistente
  (con/sin espacio) provenía de comparar prototipos con documentación, no de datos reales.
- **`brand_name`: solo variantes de caja.** Sin errores ortográficos. Tres marcas partidas:
  `GOODYEAR`/`goodyear` (67+4), `HANKOOK`/`hankook` (40+6), `BRIDGESTONE`/`Bridgestone` (61+3).
  13 mediciones de 2 247 (~0,6 %).
- **Hallazgo no previsto: `QA-TEST` en producción** — 9 cascos y 14 mediciones de datos de prueba
  mezclados con datos reales.

Consecuencias:

1. El buscador **no requiere ninguna acción**: `normalizeSearchText` ya pasa a minúsculas, así que
   las variantes de caja colapsan solas. La suciedad no afecta a esta fase.
2. Lo afectado es la **agregación**, no la búsqueda: `v_rendimiento_dashboard_rows` agrupa por marca
   y hoy parte tres marcas en seis filas. Un jefe de flota comparando marcas lee números
   fragmentados sin saberlo.
3. El remedio es `upper(trim())` en la RPC de escritura más un backfill; **no hacen falta tablas de
   catálogo ni FK**. Fase separada, idealmente antes del baseline de las 2 096 posiciones: hoy son
   36 cascos, después ~3 800.
4. `QA-TEST` requiere decisión humana. Borrar datos en producción no se propone de oficio.

### 5.3 Cobertura: no existe vista unificada

Ninguna vista cubre el universo de neumáticos. La unión requeriría
`v_unit_position_state` (montados) + `v_tire_inventory_available` (retén) + `v_inventory_status`
(todos, incl. descartados), que se solapan parcialmente. Además, **las tres últimas y otras 8 vistas
existen solo en el remoto sin DDL versionado** (`tasks_cambios_neumaticos/BASELINE_REMOTO.md:60-70`);
`supabase/views_demo.sql` tiene versiones de algunas pero no está en `migrations/`.

Por eso el índice se construye desde **tablas base**: `tire_casings` garantiza que todo casco
aparece exactamente una vez, esté montado, en retén o descartado.

### 5.4 Unidad

`units` (`supabase/migrations/20260706120000_demo_vertical_slice.sql:126-141`): `plate` (único por
`(company_id, plate)`), `vehicle_type`, `config_id`, `status`, `last_odometer`, `last_inspected_at`.

No hay campo separado de número interno: el comentario de `plate` dice «placa/número interno». La
configuración (`2-4`, `2-4-2`) no está en `units` — es `vehicle_configs.notation` vía `config_id`.

### 5.5 RLS y multiempresa

`supabase/migrations/20260710090000_dashboard_public_rls.sql`. `profiles.company_id` es **escalar
`not null`**; toda policy filtra por `current_company_id()`. Ningún usuario ve más de una empresa.
«Global» significa siempre «mi empresa». Los roles existen (`inspector`, `supervisor`,
`fleet_manager`, `workshop_manager`, `admin`) pero **no diferencian la lectura**.

Deriva conocida a no repetir: cuatro vistas remotas tienen `GRANT ALL` a `anon` **y**
`authenticated` (`BASELINE_REMOTO.md:100-107`).

### 5.6 Índices de texto: no existe ninguno

Todos los índices son b-tree. Cero `pg_trgm`, cero GIN, cero `tsvector`, cero índices funcionales
`lower()`. La única extensión instalada es `btree_gist`, usada para un `exclude` de rutas.

- `units.plate` no tiene índice propio (solo el UNIQUE compuesto).
- `inspection_measurements.tire_code` no tiene ninguno.

Cualquier `ilike` servidor sería seq scan. Es una razón adicional para el índice cacheado en cliente.

## 6. Escala

Cifras de producción verificadas en `tasks_puesta_en_marcha_movimientos/STATE.md:275-277`:

> 4 empresas, 269 unidades, 286 inspecciones, 2 232 mediciones, 36 cascos / 37 ciclos /
> 37 instalaciones.

Pero hay **2 096 posiciones en `baseline_pending`** (`STATE.md:265-270`): CIVA 854, MÓVIL BUS 730,
ITTSABUS 512. Cuando taller complete la línea base los neumáticos crecen ~60×, hacia el orden de
**500 unidades / 3 800 neumáticos** que ya aparece en `tasks_opencode/task_09_refactor_nucleo_datos.md:6-7`.

**El índice debe dimensionarse contra esa cifra, no contra los 36 cascos de hoy.**

Precedente de techo silencioso a no repetir: `instalacion.html` trae `limit: '200'` sin paginación ni
aviso de «hay más» (`dashboard_ui_ux_audit.md:222-224`).

## 7. Restricciones de diseño

`DESIGN.md` y `knowledge/ai/09 - Diseno y UX.md`:

- JetBrains Mono en todo; `tabular-nums` en todo número.
- **Regla del Naranja Único**: un solo elemento naranja por pantalla.
- **Regla de la Sombra Reservada**: `box-shadow` solo para elementos que flotan sobre contenido.
  Un overlay califica: `0 8px 24px rgba(0,0,0,0.4)` sobre oscuro.
- Sin rojo. El naranja es la máxima severidad.
- Estado por borde 2px, no por sombra. Disabled por recolor, nunca `opacity`.
- Motion 0.15–0.28 s, `ease-out`, sin rebote. `prefers-reduced-motion: reduce` desactiva todo.
- Catálogo en datos, nunca en componente.

## 8. Vocabulario

`knowledge/ai/13 - Glosario.md`. Términos canónicos: **unidad** (no bus/coche), **neumático** (uso
mixto con «llanta»), **casco** (identidad física permanente), **ciclo**, **retén**, **descartado**,
**Direccional/Tracción/Libre** (no «dirección»).

Riesgo: la inconsistencia terminológica del propio repo se amplifica en un buscador de texto. Un
usuario que teclea «llanta» contra un índice que dice «neumático» falla.

## 9. Huecos que quedan abiertos

Confirmados como no documentados en todo el repo:

1. Frecuencia y duración de uso de la web por rol — la variable que más condiciona el diseño.
2. Si el usuario es teclado-céntrico o ratón-céntrico; escritorio o tablet.
3. Alfabetización digital del jefe de flota: cero menciones.
4. Cuántos usuarios web hay por empresa.
5. Si `R3`/`R4` son reales (aparecen en prototipos, no en la spec vigente).
6. Si las medidas se normalizan con o sin espacio (`295/80 R22.5` vs `295/80R22.5`).

Los puntos 5 y 6 afectan al `haystack`; los 1-4 afectan a la evaluación posterior, no al alcance.

## 10. Ausencia de ADR de UI

`decisions/` tiene 4 ADRs, **todos de backend** (`0001-tenancy`, `0002-calc-parity`,
`0003-jwt-offline`, `0004-catalog-sync`). No existe ninguno sobre navegación, búsqueda o filtros.
Este trabajo introduce un patrón sistémico nuevo y `CLAUDE.md` + `knowledge/ai/14` exigen
documentarlo: sería el **primer ADR de UI del proyecto**.
