# task_03 — Migración: procedencia, helper extraído y vista extendida

**1. Propietario**: CLAUDE.

**2. Objetivo y resultado observable**
Escribir (no aplicar) la migración que (a) hace distinguible una línea base de un montaje de taller,
(b) extrae de `register_full_installation` el helper que el primer montaje va a reutilizar, y (c)
expone en `v_unit_position_state` la evidencia que la UI necesita para dejar de mentir. Resultado
observable: la migración existe, revisada por `sync-migration-reviewer`, con su `down`, y ejecutada
en una transacción efímera contra el remoto **`supabase/tests/workshop_rpcs.test.sql` sigue
terminando en `TESTS_PASSED` sin haberle tocado una línea**.

**3. Dependencias y tareas que bloquea**
Depende de: `task_01`, **D1**. Bloquea: `task_04`.

**4. Archivos**
- Permitidos (exclusivos):
  - `supabase/migrations/20260716100000_baseline_provenance_and_helper.sql`
  - `supabase/migrations/down/20260716100000_down.sql` (**carpeta nueva**; crearla es parte de la
    tarea, con un README de una línea aclarando que son scripts de reversión, no migraciones).
- Prohibidos: `20260712000000_workshop_tire_operations_rpcs.sql` y `20260714100000_*` — **no se
  editan migraciones ya aplicadas**; se las reemplaza con `create or replace` desde la migración
  nueva. También prohibidos `supabase/tests/**`, `WEB/**`, `app/**`, y aplicar al remoto salvo la
  prueba efímera del paso 8.

**5. Contratos**
Crea (propuestos, `PLAN.md §2.1` y `§3`): enum `record_origin`; columnas `origin` en
`tire_casings`/`tire_life_cycles`/`tire_installations` y `source_measurement_id` en
`tire_installations`; helper `fn_create_casing_cycle_installation(…)`; `v_unit_position_state`
extendida.
Reutiliza (verificados): `register_full_installation` (`20260712000000:110-195`),
`fn_validate_free_position` (`:62-105`), `v_unit_position_state` (`20260714100000:8-67`),
`inspection_measurements` (`20260706120000:263-300`).

**6. Pasos**
1. Encabezado que explique por qué existe: sin procedencia, una línea base y un montaje físico son
   la misma fila (`AUDIT.md` B1); y que el helper se extrae para no duplicar
   `register_full_installation:165-188` (`AUDIT.md` B11).
2. `create type public.record_origin as enum ('workshop','baseline');`
3. `alter table` de las tres tablas con **`default 'workshop'`** — así las 37 filas existentes
   quedan correctamente marcadas sin un solo `update` (`PLAN.md §3.1`).
4. `check (origin <> 'baseline' or source_measurement_id is not null)` en `tire_installations`, e
   índice `tire_installations_origin_idx … where origin = 'baseline'`.
5. **Extraer el helper** (`PLAN.md §2.1`):
   - `create function public.fn_create_casing_cycle_installation(…) returns jsonb`, `security
     definer`, `set search_path = public`, con el **cuerpo actual** de
     `register_full_installation:142-193` más los parámetros `p_origin` y `p_source_measurement_id`.
   - `create or replace function public.register_full_installation(…)` con **la misma firma exacta**
     (los 15 parámetros de `20260712000000:110-126`), que ahora solo llama a
     `fn_require_workshop_profile()` y delega en el helper con `p_origin => 'workshop'`,
     `p_source_measurement_id => null`. **Su retorno y sus mensajes de error no cambian.**
   - Reponer los `revoke`/`grant` de `register_full_installation` tal como están hoy
     (`:345-346`): un `create or replace` conserva los privilegios, pero repetirlos hace la
     migración autocontenida y auditable.
   - Helper interno: `revoke all on function … from public, anon, authenticated;` — igual que
     `fn_mount_existing_cycle` (`20260714110000:169-171`).
6. `create or replace view public.v_unit_position_state` **agregando columnas al final**
   (`PLAN.md §3.2`): `installation_origin`, `baseline_pending`, `last_measurement_id`,
   `last_brand_name`, `last_model_name`, `last_size_name`, `last_condition`,
   `last_retread_design`, `last_odometer_km`. Las `last_*` salen del `left join lateral` que la vista
   **ya tiene** (`20260714100000:54-67`): se amplía su `select` interno, **no se agrega un join**.
   Repetir `security_invoker = true`, `revoke all` + `grant select to authenticated` y actualizar el
   `comment on view` (hoy `20260714100000:69-70`).
7. `comment on` en cada objeto nuevo: qué es, qué **no** afirma, y qué significa `origin='baseline'`
   (identidad confirmada por una persona; **fecha de montaje declarada, no observada** — D1).
8. Escribir `down/20260716100000_down.sql`: dropear helper, columnas, enum, y **restaurar
   `register_full_installation` y `v_unit_position_state` a su definición vigente literal**
   (`20260712000000:110-195`, `20260714100000:8-67`) — copiarlas, no reescribirlas de memoria.
9. Pasar la migración por el agente `sync-migration-reviewer`.
10. Probar en efímero: `begin;` → migración → verificaciones → `workshop_rpcs.test.sql` →
    `unit_state_reads.test.sql` → `tire_change_batch.test.sql` → `rollback;`.

**7. Invariantes**
- **Aditiva**: no borra, no renombra, no cambia tipos ni la semántica de nada existente.
- **`register_full_installation` no cambia de comportamiento.** El juez es
  `supabase/tests/workshop_rpcs.test.sql` **sin modificar**: si hay que tocarlo, la extracción está
  mal.
- `is_empty` **no cambia de semántica**: sigue siendo `ti.id is null` (`20260714100000:33`). La UI
  vigente sigue funcionando igual.
- Las 28 columnas actuales de `v_unit_position_state` conservan **nombre, tipo y orden**: `data.js`
  las selecciona por nombre (`data.js:1-30`).
- `default 'workshop'` es obligatorio: sin él, las 37 filas de taller quedarían mal clasificadas.
- Grants mínimos: el helper **no** es ejecutable por `anon`/`authenticated`; la vista solo `select`
  a `authenticated`, **nunca** `anon` (no repetir la deriva D-C de `BASELINE_REMOTO.md:132-138`).
- `search_path` fijo en toda función `security definer`.
- Timestamp > `20260714042911` (última remota, `AUDIT.md §4.1`).
- No toca `v_inventory_status` ni las vistas `v_casing_*` sin DDL versionado (`AUDIT.md` B9).

**8. Casos de error, ambigüedad y concurrencia**
- Colisión de nombres: verificar antes con
  `select to_regtype('public.record_origin'), to_regproc('public.fn_create_casing_cycle_installation');`
  → ambos `null`. Si existen, **detenerse** y reportar.
- `create or replace view` falla si se cambia el tipo u orden de una columna existente: por eso las
  nuevas van **al final**. Si Postgres rechaza el replace, es señal de que se alteró algo de arriba:
  **no** forzar con `drop view … cascade` (rompería dependencias no versionadas, `AUDIT.md` B9).
- `create or replace function` con firma distinta **crea una sobrecarga** en vez de reemplazar. La
  firma de `register_full_installation` debe ser idéntica, parámetro por parámetro y default por
  default. Verificar con `select count(*) from pg_proc where proname='register_full_installation';`
  → **1**.
- `alter table add column` toma `ACCESS EXCLUSIVE` brevemente; con default constante Postgres no
  reescribe la tabla (37 filas, irrelevante).

**9. Criterios de aceptación**
- La migración corre limpia dentro de `begin … rollback` contra el remoto.
- `select origin, count(*) from tire_installations group by 1;` → `workshop`=37, y nada más.
- `select count(*) from pg_proc where proname='register_full_installation';` → **1** (no se creó
  una sobrecarga).
- Las **3 suites SQL vigentes** terminan en `TESTS_PASSED`, **sin editarlas**.
- `v_unit_position_state` devuelve las 28 columnas originales + 9 nuevas, y
  `select count(*) filter (where baseline_pending)` ≈ 2 092 (`AUDIT.md §4.4`); si difiere, explicar.
- El helper no es ejecutable por `anon` ni `authenticated` (evidencia: `pg_proc.proacl`).
- El `down` revierte todo dentro del mismo efímero y las 3 suites vuelven a pasar después.
- `sync-migration-reviewer` sin hallazgos abiertos.

**10. Comandos y verificación**
MCP `execute_sql` sobre `fbxupwwgiebhlciqftpw`, **todo** envuelto en `begin;` … `rollback;`.
Revisión: agente `sync-migration-reviewer` sobre el archivo.

**11. Rollback / limpieza**
La tarea **no aplica nada persistente**: su única ejecución remota se revierte con `rollback`.
`down/20260716100000_down.sql` queda escrito y probado para que `task_06` pueda revertir la
aplicación real. No hay datos que revertir: la migración es puro DDL aditivo.

**12. Handoff a `STATE.md`**
Fila `task_03` → `Resultado`: **firma literal** de `fn_create_casing_cycle_installation` (la
consume `task_04`), nombres y tipos exactos de las 9 columnas nuevas de `v_unit_position_state`
(las consume `task_07`), confirmación de que las 37 filas quedan `origin='workshop'` y de que
`register_full_installation` sigue siendo una sola función con la firma de siempre, y el conteo real
de `baseline_pending`. `Revisión`: salida del efímero, `TESTS_PASSED` ×3 sin editar tests, resultado
del `sync-migration-reviewer` y verificación de que `v_inventory_status`/`v_casing_*` siguen
resolviendo.
