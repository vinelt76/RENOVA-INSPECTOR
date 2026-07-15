# PLAN — Puesta en marcha de Movimientos de Neumáticos

Fecha: 2026-07-14. Autor: CLAUDE (orquestador). Evidencia: `AUDIT.md`.
Alcance revisado por el humano el 2026-07-14: **línea base perezosa**, sin backfill masivo
(ver `DECISIONES.md` D0).

Todo nombre nuevo es **contrato propuesto** salvo que se marque como **verificado** (existe hoy en
el repo/remoto). Cada contrato propuesto tiene una tarea responsable de crearlo y pruebas que lo
validan.

---

## 1. Arquitectura encontrada y el hallazgo que ordena el plan

```
app Android ──sync──▶ inspections / inspection_measurements   (evidencia histórica, inmutable)
                                  │
                                  ├──────────────▶ v_unit_position_state.last_inspection_tire_code
                                  │                 last_rtd_movi_mm · last_pressure_psi · last_inspected_on
                                  │                 ▲ LA EVIDENCIA YA LLEGA A LA UI
                                  ✗ pero no crea instalaciones
                                  ▼
taller (RPCs) ─────▶ tire_casings ─▶ tire_life_cycles ─▶ tire_installations ─▶ tire_removals
                                                              │
                                                              ▼
                                          v_unit_position_state.is_empty = (ti.id is null)
```

**El hallazgo**: `v_unit_position_state` **ya trae la evidencia de inspección de cada posición**
(`20260714100000_unit_position_state_and_inventory_views.sql:34-37`), y `data.js:25-29` **ya la
descarga**. Lo que falta no es un backfill: es que la UI distinga dos cosas que hoy pinta iguales.

| Situación real | Hoy la UI dice | Debe decir |
|---|---|---|
| `is_empty` y **sin** evidencia de inspección | "VACÍA · DISPONIBLE PARA MONTAJE" | igual (correcto) |
| `is_empty` y **con** `last_inspection_tire_code` | "VACÍA · DISPONIBLE PARA MONTAJE" ← **falso y peligroso** | "PENDIENTE DE LÍNEA BASE · `<código>`" |

El segundo caso son 2 092 posiciones de 262 unidades (`AUDIT.md §4.4`). La UI las ofrece hoy para
montar inventario encima de un neumático que probablemente está físicamente ahí. **Ese es el bug
real**, y no requiere escribir una sola fila para arreglarlo.

**Estrategia**: la línea base de una posición nace **cuando alguien va a operar sobre ella**, con la
evidencia de la inspección precargada y una persona confirmando delante del bus. Una posición sin
línea base no acepta movimientos normales: solo el primer montaje.

Principio rector: **la inspección es evidencia; la instalación es una afirmación**. Nadie afirma
por lote: afirma quien mira el neumático.

---

## 2. Reutilización: qué ya está implementado y se usa tal cual

Esta es la columna vertebral del plan y lo que evita reinventar nada.

| Necesidad | Ya existe | Evidencia |
|---|---|---|
| Crear casco + ciclo + instalación en una transacción | `register_full_installation` | `20260712000000_workshop_tire_operations_rpcs.sql:110-195` |
| Validar posición libre y de la empresa | `fn_validate_free_position` | `:62-105` |
| Derivar empresa y rol del perfil, nunca del navegador | `fn_require_workshop_profile` | `:28-56` |
| Montar un ciclo existente y disponible | `fn_mount_existing_cycle` | `20260714110000:60-159` |
| Idempotencia por `batch_id` + advisory lock | patrón de `confirm_tire_change_batch` | `20260714120000:129-143` |
| Candados de concurrencia | 3 índices parciales únicos | `20260706120000:176-177`, `:198-199`, `:218-221` |
| Evidencia de inspección por posición | `v_unit_position_state` | `20260714100000:34-37` |
| Clasificar errores de dominio en la UI | `rpc.js` | `WEB/tire-change/rpc.js:65-80` |

**Lo único que falta de verdad**: (a) marcar la procedencia, (b) que la UI vea "pendiente de línea
base", (c) un RPC de primer montaje que reutilice lo de arriba, (d) un candado que impida operar
sobre una línea base ausente.

### 2.1 Extracción del helper (patrón ya establecido en este repo)

`register_full_installation:165-188` hace exactamente los tres `insert` que el primer montaje
necesita. **No se reimplementan**: se extraen a un helper interno y ambos lo llaman. Es literalmente
lo que el proyecto ya hizo cuando `confirm_tire_change_batch` necesitó montar: no duplicó código,
extrajo `fn_mount_existing_cycle` (`20260714110000:52-59`).

```sql
create function public.fn_create_casing_cycle_installation(
  p_profile              public.profiles,
  p_casing_code          text,
  p_brand_name           text,
  p_model_name           text,
  p_size_name            text,
  p_condition            public.tire_condition,
  p_retread_design       text,
  p_otd_mm               numeric,
  p_cost                 numeric,
  p_currency             text,
  p_unit_id              uuid,
  p_position             smallint,
  p_installed_at         date,
  p_odometer             integer,
  p_rtd_mm               numeric,
  p_origin               public.record_origin,
  p_source_measurement_id uuid,
  p_notes                text
) returns jsonb   -- { casing_id, life_cycle_id, installation_id }
language plpgsql security definer set search_path = public
```

- Contiene **el cuerpo actual** de `register_full_installation:142-193`: validaciones de fecha y
  condición, `fn_validate_free_position`, unicidad del código, mapa `condition → cycle_number`
  (`:162-163`), y los tres `insert`.
- `register_full_installation` pasa a ser un envoltorio que llama al helper con
  `p_origin => 'workshop'` y `p_source_measurement_id => null`. **Su firma, su retorno y su
  comportamiento no cambian**: `supabase/tests/workshop_rpcs.test.sql` debe pasar sin tocar una
  línea. Ese es el criterio de que la extracción fue correcta.
- Interno: `revoke all … from public, anon, authenticated`, igual que `fn_mount_existing_cycle`
  (`20260714110000:169-171`) y que los helpers restringidos en remoto
  (`BASELINE_REMOTO.md:141-156`).

---

## 3. Contrato propuesto: procedencia y evidencia visible (`task_03`)

Migración propuesta: **`supabase/migrations/20260716100000_baseline_provenance_and_helper.sql`**
(timestamp > `20260714042911`, la última remota — `AUDIT.md §4.1`).

### 3.1 Enum y columnas — **propuestos**

```sql
create type public.record_origin as enum (
  'workshop',   -- operación de taller sobre un neumático que la persona tenía delante
  'baseline'    -- primer montaje: identidad tomada de una inspección previa, confirmada por una persona
);

alter table public.tire_casings     add column origin public.record_origin not null default 'workshop';
alter table public.tire_life_cycles add column origin public.record_origin not null default 'workshop';
alter table public.tire_installations
  add column origin public.record_origin not null default 'workshop',
  add column source_measurement_id uuid references public.inspection_measurements(id);
```

- `default 'workshop'` marca correctamente las 37 filas existentes **sin un solo `update`**:
  las creó taller. Compatibilidad legacy garantizada por el default.
- `check (origin <> 'baseline' or source_measurement_id is not null)`: una línea base **siempre**
  cita su evidencia.
- `create index tire_installations_origin_idx on public.tire_installations (origin) where origin = 'baseline';`

Qué significa `origin='baseline'`, con honestidad: **la identidad la confirmó una persona; la fecha
de montaje no está observada** (solo sabemos que el neumático estaba ahí el día de la inspección
fuente). Por eso `installed_at` lo carga quien confirma y `source_measurement_id` deja el rastro.

No hacen falta columnas de "confirmado por/cuándo": con línea base perezosa, **toda** instalación
nace de una confirmación humana, y `installed_by` + `created_at` (`20260706120000:212`, `:215`) ya
lo registran.

### 3.2 `v_unit_position_state` extendida — **propuesta**

`create or replace view` **agregando columnas al final** (PostgREST y `data.js:1-30` seleccionan por
nombre: agregar no rompe). `is_empty` **no cambia de semántica**: sigue siendo `ti.id is null`.

| Columna nueva | Origen | Para qué |
|---|---|---|
| `installation_origin` | `ti.origin` | Etiquetar "línea base" vs. taller |
| `baseline_pending` | `ti.id is null and last_measurement.measurement_id is not null` | **El interruptor del plan**: vacía pero con evidencia |
| `last_measurement_id` | `im.id` | `source_measurement_id` del primer montaje |
| `last_brand_name`, `last_model_name`, `last_size_name` | `im.*` | Precargar el formulario |
| `last_condition`, `last_retread_design` | `im.*` | Precargar (0 filas fuera del enum, `AUDIT.md §4.3`) |
| `last_odometer_km` | `i.odometer_km` | Precargar |

Todas salen del `left join lateral` que la vista **ya tiene** (`20260714100000:54-67`): se agregan
columnas al `select` interno, no un join nuevo.

#### Por qué el predicado es "existe medición" y no "existe código"

`task_01` lo midió y lo cambió: **el predicado correcto es la existencia de la medición**.

- Las 2 125 mediciones de la última inspección **siempre** tienen `rtd_movi_mm` (entre 2,0 y 17,0
  mm, ningún cero), marca, medida y condición dentro del enum (`AUDIT.md §4.3`). Si el inspector
  midió la profundidad, **había un neumático**. La medición es evidencia física; el código es solo
  identidad, y a veces no se puede leer.
- Con el predicado por **código**: 1 784 posiciones pendientes. Las 309 medidas sin código quedarían
  fuera del candado y la UI seguiría ofreciendo montar inventario encima — el bug que estamos
  arreglando, intacto justo donde más falta hace.
- Con el predicado por **medición**: **2 092 posiciones** (97,6 % del universo). El caso "hay
  neumático pero no se pudo leer el código" queda protegido, que es exactamente el que más lo
  necesita.

> Con los datos de hoy (`AUDIT.md §4.4`): `baseline_pending = true` en **2 092** posiciones de 262
> unidades. `false` en las 35 ya ocupadas por taller y en las **17** legítimamente vacías (sin
> medición en la última inspección). Las 309 sin código entran al flujo con el campo de código
> vacío y obligatorio: lo carga quien mira el neumático.

---

## 4. Contrato propuesto: primer montaje guiado (`task_04`)

Migración propuesta: **`supabase/migrations/20260716110000_baseline_mount_rpc_and_gate.sql`**.

### 4.1 Por qué un RPC propio y no el lote actual

| Requisito del primer montaje | `confirm_tire_change_batch` |
|---|---|
| Crear un casco desde una identidad de texto | No: `mount` exige un `life_cycle_id` existente (`20260714120000:212-217`) |
| No tener posición origen | Sus ops de origen exigen `expected_life_cycle_id` (`:181-186`) |
| Marcar procedencia y evidencia | No escribe `origin` ni `source_measurement_id` |

Meterlo dentro del lote sería una quinta op con semántica distinta que degradaría el bloqueo
optimista. **RPC propio, con el mismo patrón de idempotencia**, reutilizando
`fn_create_casing_cycle_installation` (§2.1) y `fn_mount_existing_cycle`. Cero lógica transaccional
en JavaScript.

### 4.2 `confirm_baseline_mount(p_batch jsonb) returns jsonb` — **propuesta**

Payload v1 (una unidad, N posiciones — se puede confirmar el bus entero de una):

```json
{
  "batch_version": 1,
  "batch_id": "5f1c…",
  "unit_id": "…",
  "performed_at": "2026-07-16",
  "odometer": 412300,
  "mounts": [
    { "seq": 1, "position": 3,
      "source_measurement_id": "…",     // evidencia que se está confirmando; null si no había
      "life_cycle_id": null,            // XOR con casing_code
      "casing_code": "ABC123",
      "brand_name": "Bridgestone", "model_name": "R268", "size_name": "295/80R22.5",
      "condition": "R1", "retread_design": "BDL2",
      "otd_mm": null, "rtd_mm": 12.5,
      "notes": "Línea base confirmada en taller" }
  ]
}
```

Retorno:

```json
{ "batch_id": "5f1c…", "applied": true, "already_applied": false,
  "unit_id": "…", "plate": "2145",
  "mounts": [ { "seq": 1, "position": 3, "casing_id": "…",
                "life_cycle_id": "…", "installation_id": "…" } ] }
```

Errores (mismo vocabulario que el lote — `rpc.js:65-80` ya clasifica estos prefijos):

| Prefijo | errcode | Cuándo |
|---|---|---|
| `[lote_invalido]` | `22023` | Forma del payload, `seq` duplicado, posición repetida, `condition` fuera del enum, `condition<>'N'` sin `retread_design` (paridad con `register_full_installation:148-150`), ni `life_cycle_id` ni `casing_code`, o ambos |
| `[sin_permiso]` | `42501` | `fn_require_workshop_profile()` falla, o la unidad no es de la empresa del perfil |
| `[posicion_ocupada]` | `23505` | La posición ya tiene instalación activa |
| `[codigo_en_uso]` | `23505` | El código ya existe en la empresa. El mensaje **debe** ofrecer la salida real: usar el ciclo existente vía `life_cycle_id` |
| `[no_disponible]` | `22023` | El `life_cycle_id` no existe, no es de la empresa, no está activo o ya está montado (lo levanta `fn_mount_existing_cycle:90-117`) |
| `[evidencia_invalida]` | `22023` | `source_measurement_id` no pertenece a esa unidad+posición |

Semántica:

1. Advisory lock por `batch_id` → consulta `baseline_mount_batches` → si existe, devuelve `result`
   con `already_applied=true`. Patrón calcado de `20260714120000:129-143`.
2. `fn_require_workshop_profile()` — **la empresa sale del perfil, nunca del payload**.
3. `select … from units where id = … and company_id = … for update`.
4. Por cada mount, ordenado por `position` (anti-deadlock, igual que `20260714120000:368-381`):
   - Validar `source_measurement_id` contra `inspection_measurements` + `inspections.unit_id` y
     `position_number`.
   - Con `casing_code` → `fn_create_casing_cycle_installation(…, p_origin => 'baseline',
     p_source_measurement_id => …)`.
   - Con `life_cycle_id` → `fn_mount_existing_cycle(…)` y luego
     `update tire_installations set origin='baseline', source_measurement_id=… where id=…`.
   - `update inspection_measurements set life_cycle_id = <ciclo> where id = source_measurement_id`
     — **único toque al histórico**: puebla la columna que el esquema reservó para esto y que hoy
     está vacía en las 2 232 filas (`20260706120000:268`, `AUDIT.md` B2). No altera RTD, presión,
     anomalías ni derivados.
5. Persistir en **`baseline_mount_batches`** (tabla propuesta, gemela de `tire_change_batches`:
   mismas columnas, misma RLS `select_own_company` de `20260714110000:42-45`, `revoke all` +
   `grant select to authenticated`) y devolver.

**Exposición**: `revoke all … from public, anon; grant execute … to authenticated`. Genera el WARN
de advisor esperado, igual que el resto de RPCs de taller (`BASELINE_REMOTO.md:171-174`).

**Concurrencia**: los tres índices-candado son la garantía final; las validaciones solo mejoran el
mensaje. **Recuperación ante red**: `batch_id` del cliente ⇒ reintentar el payload idéntico devuelve
`already_applied=true` sin re-aplicar — el contrato que `rpc.js:89-161` ya sabe manejar.

---

## 5. Gate: qué se bloquea sin línea base (`task_04`)

`create or replace function public.confirm_tire_change_batch(p_batch jsonb)` — **misma firma**, no
rompe `rpc.js:9`. Tras validar la unidad (`20260714120000:145-153`) y antes de los locks de origen,
rechazar todo `mount` sobre una posición con `baseline_pending`:

```
[linea_base_pendiente] La posición P% de % tiene un neumático conocido por la inspección del %
(código %) y todavía no tiene línea base. Registrá el primer montaje antes de montar otro
neumático ahí.                                                     -- errcode 22023
```

- **Determinista y basado en evidencia**: se dispara solo si la última inspección **midió** esa
  posición y no hay instalación activa. Es exactamente el caso peligroso (`AUDIT.md §6`): montar
  inventario encima de un neumático físico no registrado. Cubre las 2 092 posiciones, **incluidas
  las 309 cuyo código el inspector no pudo leer** (§3.2).
- Una posición vacía **sin** medición (17 hoy) sigue aceptando `mount` normalmente: no hay nada que
  contradecir.
- El mensaje usa el código si existe; si no, cita la fecha de la inspección y el RTD medido. Nunca
  afirma un código que no tiene.
- `send_to_retention` / `discard` / `swap` **no necesitan gate**: ya exigen instalación activa en el
  origen (`:390-399`), o sea, línea base existente.
- La salida siempre existe y es explícita: el primer montaje (§4.2). Nada queda trabado sin camino.

`rpc.js:10-16` suma `baseline_pending` a `DOMAIN_ERROR_CLASSES` y `classifyBatchError` mapea
`[linea_base_pendiente]` (`task_08`). Un error de dominio nunca se reintenta.

---

## 6. Flujo de la UI (`task_07`, `task_08`)

```
posición vacía + baseline_pending=false  ──▶ "VACÍA · DISPONIBLE PARA MONTAJE"  ──▶ montar del retén
posición vacía + baseline_pending=true   ──▶ "PENDIENTE DE LÍNEA BASE · ABC123" ──▶ [Registrar primer montaje]
                                                                                      │ formulario precargado
                                                                                      │ desde last_* de la vista
                                                                                      ▼
                                                                              confirm_baseline_mount
                                                                                      │
posición ocupada, origin='baseline'      ──▶ "ABC123 · LÍNEA BASE" ◀─────────────────┘
posición ocupada, origin='workshop'      ──▶ "ABC123"
```

- El formulario del primer montaje llega **precargado** con `last_inspection_tire_code`,
  `last_brand_name`, `last_model_name`, `last_size_name`, `last_condition`, `last_retread_design`,
  `last_rtd_movi_mm` y `last_odometer_km` (§3.2), y muestra de dónde salen: "según la inspección del
  `<last_inspected_on>`". Todos los campos son **editables**: la persona está mirando el neumático,
  la inspección solo ahorra tipeo.
- Se puede confirmar **varias posiciones de una** (el payload acepta N mounts): un bus completo es
  una sola confirmación, no ocho.
- Sin código en la evidencia (309 posiciones): mismo flujo, campo de código vacío y obligatorio.
- Código duplicado (123 posiciones): el RPC responde `[codigo_en_uso]` y la UI ofrece la salida real
  — buscar ese código en el inventario y montarlo por `life_cycle_id`. La ambigüedad se resuelve
  **en el momento y con una persona**, que es la razón por la que este enfoque es mejor que un
  algoritmo adivinando.
- El borrador del primer montaje persiste en `localStorage` con el mismo patrón que el lote
  (`batch-store.js:35-39`) y sobrevive una recarga.

---

## 7. Política de nomenclatura y compatibilidad del renombre (`task_02`)

### 7.1 Qué migra

| Hoy | Después |
|---|---|
| `WEB/tire-change/` | `WEB/movimientos/` |
| `cambios-controller.js` | `movimientos-controller.js` |
| `tire-change.css` | `movimientos.css` |
| `TIRE_CHANGE_MODES.CHANGES = "cambios"` | `MOVIMIENTOS_MODES.MOVEMENTS = "movimientos"` |
| ids `cambios-*`, `modo-cambios`, `tab-cambios` | `movimientos-*`, `modo-movimientos`, `tab-movimientos` |
| clases `tire-change-panel/-dock/-mode` | `movimientos-panel/-dock/-mode` |
| `html[data-renova-mode="cambios"]` | `…="movimientos"` |
| textos "Cambios" | "Movimientos" |
| `"name": "renova-tire-change"` | `"name": "renova-movimientos"` |
| `renova:tire-change:` (localStorage) | `renova:movimientos:` |

### 7.2 Qué NO migra (compatibilidad deliberada, probada en `AUDIT.md §5.2`)

`confirm_tire_change_batch`, `tire_change_batches`, `v_unit_position_state`,
`v_tire_inventory_available`, `fn_mount_existing_cycle`, `supabase/tests/tire_change_batch.test.sql`
y las carpetas históricas `tasks_cambios_neumaticos*/`. Motivo: están **aplicados en producción** y
son nombres técnicos sin superficie de usuario; renombrarlos exige función nueva + shim +
coordinación de despliegue, sin beneficio para nadie. La equivalencia se documenta en
`knowledge/ai/13 - Glosario.md`.

### 7.3 Alias y canonicalización

- **URL**: `modeFromSearch` acepta `movimientos` **y** `cambios`; ambos dan el modo Movimientos.
  `updateUrl` escribe **siempre** `?mode=movimientos` con `history.replaceState` (mecanismo que ya
  existe, `mode-toggle.js:13-23`). Un enlace viejo abre la pantalla correcta y se auto-canonicaliza.
- **Vigencia**: D3. Recomendación: **permanente en lectura** (3 líneas, costo cero).
- **localStorage**: al leer, `batch-store.js` busca la clave nueva; si no está, lee la vieja
  (`renova:tire-change:*`), la reescribe con el prefijo nuevo y borra la vieja. Un borrador o un lote
  sellado en curso al desplegar **no se pierde**.
- **Sin cambio funcional**: `task_02` es un renombre puro. Criterio de aceptación: las 10 suites
  vigentes pasan **sin cambiar una sola aserción de comportamiento**, solo rutas e ids.

### 7.4 Por qué el renombre va primero

No depende de nada del backend: CODEX lo corre **en paralelo** con el diseño de migraciones de
CLAUDE. Hacerlo antes evita que la UI del primer montaje (`task_08`) nazca con nombres que después
haya que renombrar, y mantiene el renombre como un commit reversible y aislado (`AUDIT.md` B10).

---

## 8. Despliegue, rollback y observabilidad

### 8.1 Orden

| Paso | Qué | Aprobación |
|---|---|---|
| 1 | `20260716100000_baseline_provenance_and_helper.sql` (enum, columnas con default, helper extraído, vista extendida) | `sync-migration-reviewer` + humano |
| 2 | `20260716110000_baseline_mount_rpc_and_gate.sql` (RPC, tabla de lotes, gate) | ídem |
| 3 | Renombre (`task_02`) | — |
| 4 | UI: proyección de línea base + flujo guiado | — |

Los pasos 1 y 2 son **compatibles hacia atrás**: la UI vigente sigue funcionando sin conocerlos
(columnas aditivas, RPC nueva, gate que solo se dispara sobre un `mount` que hoy sería un error de
datos). Soporta despliegue gradual y no exige coordinar UI y base en el mismo momento.

**No hay paso de escritura masiva.** Ese es el punto del enfoque perezoso: producción no recibe
ninguna corrida de datos; recibe DDL aditivo y nada más. Es la diferencia entre revertir un `drop
column` y revertir 1 660 filas de negocio.

### 8.2 Rollback

| Paso | Rollback |
|---|---|
| 1, 2 (DDL) | `supabase/migrations/down/*.sql` versionados y probados en efímero (`task_03`, `task_04`): `drop function` / `drop table` / `alter table … drop column` / `drop type`, y **restaurar `v_unit_position_state` y `register_full_installation` a su definición vigente literal** (`20260714100000:8-67`, `20260712000000:110-195`). Todo aditivo ⇒ revertir no pierde datos preexistentes. |
| Datos creados por el flujo guiado | **No se revierten en masa**: cada instalación la creó una persona confirmando un neumático real. Es historia legítima, igual que cualquier operación de taller. Si una está mal, se corrige con las RPCs vigentes (`register_removal`), no con un borrado. |
| 3 (renombre) | `git revert`. El alias de URL y la lectura de `localStorage` viejo hacen que ir y volver no rompa enlaces ni borradores. |
| 4 (UI) | `git revert`. Sin efecto en datos. |

### 8.3 Observabilidad

- `supabase/diagnostics/baseline_profile.sql` (`task_01`): mide cuántas posiciones están
  `baseline_pending` y cuántas ya tienen línea base. Es el indicador de avance de la puesta en
  marcha, corrible cuando se quiera.
- `select origin, count(*) from tire_installations group by 1;` → cuánto es taller y cuánto línea
  base.
- Cada línea base es rastreable: `origin='baseline'` + `source_measurement_id` →
  `inspection_measurements` → `inspections.inspected_on`.
- `baseline_mount_batches.payload`/`result` conservan cada confirmación como historia auditable,
  igual que `tire_change_batches`.

---

## 9. Grafo de dependencias

```
task_01 (diagnóstico, CLAUDE) ──▶ task_03 (procedencia + helper + vista, diseño)
                                       └──▶ task_04 (RPC primer montaje + gate, diseño)
                                                 └──▶ task_05 (pruebas SQL)
                                                           └──▶ task_06 (APLICA 1+2) ⚠ humano
task_02 (renombre, CODEX) ─────────────────────────────────────┐
                                                               ▼
                                        task_06 ──▶ task_07 (datos + proyección, CODEX)
                                                          └──▶ task_08 (flujo guiado UI, CODEX)
                                                                    └──▶ task_09 (pruebas + docs, CODEX)
                                                                              └──▶ task_10 (revisión cruzada)
```

Paralelizable desde el día 1: `task_01`+`task_03` (CLAUDE) con `task_02` (CODEX). Ningún par de
tareas concurrentes comparte archivo (ver `STATE.md`).
