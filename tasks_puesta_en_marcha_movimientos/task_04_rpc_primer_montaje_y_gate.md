# task_04 — Migración: RPC de primer montaje y gate de línea base

**1. Propietario**: CLAUDE.

**2. Objetivo y resultado observable**
Escribir (no aplicar) el RPC que convierte la evidencia de una inspección en línea base con una
confirmación humana, y el candado que impide montar inventario encima de un neumático físico no
registrado. Resultado observable: la migración existe, revisada, con `down`; y en efímero,
`confirm_baseline_mount` crea la línea base de una posición y `confirm_tire_change_batch` rechaza
con `[linea_base_pendiente]` un `mount` sobre una posición con evidencia contradictoria.

**3. Dependencias y tareas que bloquea**
Depende de: `task_03`, **D2**. Bloquea: `task_05`, `task_07`.

**4. Archivos**
- Permitidos (exclusivos):
  - `supabase/migrations/20260716110000_baseline_mount_rpc_and_gate.sql`
  - `supabase/migrations/down/20260716110000_down.sql`
- Prohibidos: `20260716100000_*` (es de `task_03`), `20260714120000_*` (**ya aplicada: no se
  edita**; el gate entra por `create or replace` desde la migración nueva), `supabase/tests/**` (de
  `task_05`), `WEB/**`, y aplicar al remoto salvo la prueba efímera.

**5. Contratos**
Crea (propuestos, `PLAN.md §4` y `§5`): tabla `baseline_mount_batches`, función
`confirm_baseline_mount(p_batch jsonb) returns jsonb`, y el `create or replace` de
`confirm_tire_change_batch(p_batch jsonb)` con el gate.
Reutiliza (verificados y de `task_03`): `fn_create_casing_cycle_installation`,
`fn_mount_existing_cycle` (`20260714110000:60-159`), `fn_require_workshop_profile`
(`20260712000000:28-56`), `v_unit_position_state.baseline_pending`, patrón de idempotencia de
`20260714120000:129-143`, RLS `select_own_company` de `20260714110000:42-45`.

**6. Pasos**
1. `create table public.baseline_mount_batches` **gemela de `tire_change_batches`**
   (`20260714110000:9-50`): mismas columnas (`id` de cliente, `company_id`, `unit_id`,
   `requested_by`, `batch_version`, `performed_at`, `payload`, `result`, `applied_at`), mismos
   índices, `enable row level security`, policy `select_own_company`, `revoke all from anon,
   authenticated` + `grant select to authenticated`.
2. `create function public.confirm_baseline_mount(p_batch jsonb) returns jsonb`, `security definer`,
   `set search_path = public`. Cuerpo en el orden de `PLAN.md §4.2`:
   1. Validación del encabezado **sin tocar datos** (forma, `batch_version=1`, tipos), calcada de
      `20260714120000:78-114`.
   2. `fn_require_workshop_profile()` → `[sin_permiso]`.
   3. `pg_advisory_xact_lock(hashtextextended(batch_id::text, 0))` → `select … from
      baseline_mount_batches where id = batch_id` → si existe, **devolver el `result` guardado con
      `already_applied=true`** sin re-aplicar. Si es de otra empresa: `[lote_invalido]` genérico (no
      filtrar la existencia del id ajeno).
   4. `select … from units where id = … and company_id = v_profile.company_id for update`.
   5. Validación estructural de `mounts`: array no vacío, `seq` únicos, **posiciones no repetidas**,
      `condition` dentro del enum, `condition<>'N'` ⇒ `retread_design` (paridad con
      `register_full_installation:148-150`), y **XOR** `life_cycle_id` / `casing_code`.
   6. Por cada mount **ordenado por `position`** (anti-deadlock, `20260714120000:368-381`):
      - Validar `source_measurement_id` contra `inspection_measurements` ⋈ `inspections` por
        `unit_id` + `position_number` → `[evidencia_invalida]`.
      - Con `casing_code` → `fn_create_casing_cycle_installation(v_profile, …, p_origin =>
        'baseline', p_source_measurement_id => …)`.
      - Con `life_cycle_id` → `fn_mount_existing_cycle(v_profile, …)` y luego
        `update tire_installations set origin='baseline', source_measurement_id=… where id=…`.
      - `update inspection_measurements set life_cycle_id = <ciclo> where id = source_measurement_id`.
   7. Normalizar carreras con `get stacked diagnostics constraint_name`, igual que
      `20260714120000:564-583`: `tire_installations_active_pos_uidx` → `[posicion_ocupada]`;
      `tire_casings_company_code_uidx` → `[codigo_en_uso]`;
      `tire_installations_active_cycle_uidx` → `[no_disponible]`.
   8. Persistir en `baseline_mount_batches` y devolver el resultado de `PLAN.md §4.2`.
3. **Gate** (`PLAN.md §5`): `create or replace function public.confirm_tire_change_batch(p_batch
   jsonb)` — **misma firma**. Partiendo del cuerpo vigente **literal** (`20260714120000:33-609`),
   insertar tras la validación de la unidad (`:145-153`) y **antes** de los locks de origen
   (`:368`), un chequeo que rechace todo `mount` sobre una posición con `baseline_pending`:
   ```
   [linea_base_pendiente] La posición P% de % tiene un neumático conocido por la inspección del %
   (código %) y todavía no tiene línea base. Registrá el primer montaje antes de montar otro
   neumático ahí.                                              -- errcode 22023
   ```
   Leer la condición de `v_unit_position_state` (o replicar su predicado): existe medición con
   código en la última inspección de esa posición **y** no hay instalación activa.
4. Grants: `revoke all on function public.confirm_baseline_mount(jsonb) from public, anon; grant
   execute … to authenticated;` Reponer también los de `confirm_tire_change_batch`
   (`20260714120000:616-617`) para que la migración sea autocontenida.
5. `comment on` en cada objeto: qué hace, qué **no** afirma (`origin='baseline'` = identidad
   confirmada por una persona, **fecha de montaje declarada**), y por qué el gate solo cubre `mount`.
6. Escribir el `down`: dropear `confirm_baseline_mount` y `baseline_mount_batches`, y **restaurar
   `confirm_tire_change_batch` a su definición vigente literal** (`20260714120000:33-609`) —
   copiarla, no reescribirla de memoria.
7. `sync-migration-reviewer`.
8. Probar en efímero: `begin;` → migración de `task_03` → esta → verificaciones → las 3 suites
   vigentes → `rollback;`.

**7. Invariantes**
- **Cero lógica transaccional duplicada**: los `insert` los hace el helper de `task_03`; el montaje
  de un ciclo existente lo hace `fn_mount_existing_cycle`. Si el RPC escribe un `insert into
  tire_casings` propio, la tarea está mal (`AUDIT.md` B11).
- **La empresa sale del perfil**, nunca del payload (`20260712000000:11-15`). Cada uuid del payload
  se valida contra ella. Cero cruce entre empresas.
- **Idempotencia por `batch_id`**: reintentar el payload idéntico devuelve `already_applied=true`
  sin crear nada. Es lo que hace seguro el retry de `rpc.js:89-161`.
- **No se degrada `confirm_tire_change_batch`**: el bloqueo optimista, el orden retiros→montajes, la
  idempotencia y la normalización de errores quedan **exactamente** como están. El gate es una
  guarda insertada, no una reescritura.
- **No se reescribe el historial**: el único `update` al histórico es
  `inspection_measurements.life_cycle_id`, columna vacía reservada para esto
  (`20260706120000:268`). No toca RTD, presión, anomalías ni derivados.
- Los tres índices-candado son la garantía final; las validaciones previas solo mejoran el mensaje.
- `search_path` fijo; `revoke`/`grant` explícitos; **nunca** `anon`.
- Ninguna operación queda sin salida: `[linea_base_pendiente]` siempre tiene el primer montaje como
  camino, y el mensaje lo dice.

**8. Casos de error, ambigüedad y concurrencia**
| Caso | Comportamiento exigido |
|---|---|
| Reintento del mismo `batch_id` | `already_applied=true`, cero filas nuevas |
| Dos `confirm_baseline_mount` concurrentes del mismo lote | El advisory lock los serializa; el segundo devuelve el `result` guardado |
| Dos lotes distintos sobre la misma posición | `tire_installations_active_pos_uidx` → `[posicion_ocupada]` |
| `casing_code` duplicado (123 posiciones, `AUDIT.md §4.4`) | `[codigo_en_uso]` con el mensaje que ofrece montar por `life_cycle_id` |
| `source_measurement_id` de otra unidad/posición | `[evidencia_invalida]` |
| Primer montaje vs. lote de cambios de la misma unidad | Ambos toman `for update` sobre `units` ⇒ se serializan |
| `mount` sobre posición sin evidencia | **Pasa**: no hay nada que contradecir (D2) |
| `mount` sobre posición con evidencia | `[linea_base_pendiente]` |
| Posición con neumático físico pero **sin código** en la inspección | **El gate no la detecta** (D2, contrapunto declarado). Se mitiga en la UI, no en la base |

**9. Criterios de aceptación**
- En efímero: `confirm_baseline_mount` con `casing_code` crea 1 casco + 1 ciclo + 1 instalación, con
  `origin='baseline'` en las tres y `source_measurement_id` no nulo.
- El mismo payload otra vez → `already_applied=true`, conteos sin cambio.
- `confirm_tire_change_batch` con un `mount` sobre una posición `baseline_pending` →
  `[linea_base_pendiente]`, `22023`, **cero escrituras**.
- El mismo `mount` sobre una posición vacía sin evidencia → **funciona** como hoy.
- Las **3 suites SQL vigentes** terminan en `TESTS_PASSED` **sin editarlas** — en particular
  `tire_change_batch.test.sql`, que prueba el lote que estamos reemplazando por `create or replace`.
- `select count(*) from pg_proc where proname='confirm_tire_change_batch';` → **1**.
- `confirm_baseline_mount` no ejecutable por `anon`; sí por `authenticated`.
- El `down` revierte y las 3 suites vuelven a pasar.
- `sync-migration-reviewer` sin hallazgos abiertos.

**10. Comandos y verificación**
MCP `execute_sql`, **todo** dentro de `begin; … rollback;`. Las pruebas formales y reproducibles son
de `task_05`; acá alcanza con la verificación manual del efímero.

**11. Rollback / limpieza**
La tarea no persiste nada (efímero con `rollback`). `down/20260716110000_down.sql` dropea el RPC y
la tabla, y restaura `confirm_tire_change_batch` a `20260714120000:33-609` literal. Sin datos que
revertir: DDL aditivo puro.

**12. Handoff a `STATE.md`**
Fila `task_04` → `Resultado`: **esquema literal del payload y del retorno** de
`confirm_baseline_mount` (lo consume `task_08`), la **lista de prefijos de error** con su errcode
(la consume `rpc.js` en `task_08`), y el texto exacto del mensaje de `[linea_base_pendiente]`.
`Revisión`: salida del efímero (creación, reintento idempotente, rechazo del gate, `mount` sin
evidencia que pasa), `TESTS_PASSED` ×3 sin editar tests, y el resultado del `sync-migration-reviewer`.
