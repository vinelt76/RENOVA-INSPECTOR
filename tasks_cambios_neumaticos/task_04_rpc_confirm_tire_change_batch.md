# task_04 — RPC transaccional `confirm_tire_change_batch`

## 1. Propietario
CLAUDE

## 2. Objetivo y resultado observable
Implementar la RPC única de confirmación general del lote (contrato 2.5 de `PLAN.md`): recibe
el lote JSON completo, revalida el estado esperado de cada posición/ciclo (bloqueo optimista),
aplica todos los movimientos o ninguno, y es idempotente por `batch_id`. Al terminar: desde una
sesión `authenticated` con rol de taller, `select public.confirm_tire_change_batch(p_batch)`
con un lote válido aplica retén/descarte/montaje/intercambio en una sola transacción y devuelve
el JSON de éxito; reinvocada con el mismo `batch_id` devuelve el resultado guardado con
`already_applied: true` sin duplicar nada.

## 3. Dependencias
- Depende de: task_03.
- Bloquea: task_05, task_06.

## 4. Archivos permitidos / prohibidos
- **Permitidos**: `supabase/migrations/20260714120000_confirm_tire_change_batch_rpc.sql`
  (crear; timestamp posterior al de task_03), `tasks_cambios_neumaticos/STATE.md` (su fila).
- **Prohibidos**: todo `app/`, todo `WEB/`, migraciones y tests existentes, archivos de
  task_02/03/05.

## 5. Contratos de entrada/salida ya verificados
**Consume (existente):** `fn_require_workshop_profile()` (`20260712000000:28-53`),
`register_removal(uuid,date,removal_reason,integer,numeric,discard_cause,text,text)`
(`20260712000000:204-282` — hace su propio `for update` y cierra ciclo/casco según reason),
`fn_validate_free_position` (ídem:62-102), índices parciales de `tire_installations`
(`20260706120000:218-221`), enum `discard_cause` (`20260706120000:52-55`).
**Consume (de task_03):** `tire_change_batches`, `fn_mount_existing_cycle(...)` (firma en
`PLAN.md` 2.4, confirmada en el handoff de task_03).

**Produce (contrato propuesto — `PLAN.md` 2.5 es vinculante, copiar de ahí la estructura JSON
del lote v1, la respuesta de éxito y la tabla de errores):**
`public.confirm_tire_change_batch(p_batch jsonb) returns jsonb`, plpgsql, `security definer`,
`set search_path = public`, `revoke all from public, anon`, `grant execute to authenticated`.

## 6. Pasos de implementación
1. Leer `BASELINE_REMOTO.md` y el handoff de task_03; comprobar documentación vigente de
   Supabase (skill/MCP) sobre funciones definer y manejo de errores vía PostgREST.
2. **Idempotencia primero**: extraer y validar `batch_id`/`batch_version`/`unit_id`/
   `performed_at` (`[lote_invalido]` si falta algo o `batch_version <> 1`). `select result
   from tire_change_batches where id = v_batch_id` — si existe, devolver `result` con
   `already_applied=true` reemplazado y terminar. (Un reintento concurrente serializa en el
   insert final por PK; documentar en comment.)
3. Autenticación: `v_profile := fn_require_workshop_profile()`; validar que `unit_id` es de la
   empresa. Validar estructura de `movements`: array no vacío, `seq` únicos, ops conocidas,
   campos obligatorios por op (descarte: `discard_cause` válido para el enum + `photo_url` no
   vacío), ninguna posición repetida como origen ni como destino (swap cuenta en ambas).
4. **Fase de bloqueo y revalidación optimista**: construir la lista de posiciones tocadas como
   origen; recorrerlas **ordenadas por position_number** haciendo `select … from
   tire_installations where unit_id and position_number and not removed for update`; comparar
   `life_cycle_id` contra el `expected_life_cycle_id` del movimiento → `[estado_desactualizado]`
   con posición, esperado y actual si difiere o si no hay instalación activa.
5. **Fase de retiros**: para cada origen, llamar `register_removal` con el reason correspondiente
   (`retention`, `discard` con causa/foto, `rotation` para lados de swap), `p_removed_at =
   performed_at`, `p_odometer = odometer` del lote (la RPC existente registra
   `odometer_source`), `p_rtd_mm` del movimiento.
6. **Fase de montajes**: para cada destino (`mount` y ambos lados de swap), llamar
   `fn_mount_existing_cycle(v_profile, ciclo, unit_id, posición, performed_at, odometer,
   rtd_mm, notes)`. Los errores del helper suben tal cual (`[no_disponible]`, ocupada).
7. Construir el JSON de respuesta (éxito por movimiento con ids, según PLAN 2.5), insertar en
   `tire_change_batches (id, company_id, unit_id, requested_by, batch_version, performed_at,
   payload, result)` y devolverlo. Cualquier excepción en cualquier fase revierte TODO
   (una función = una transacción; no usar subtransacciones que dejen efectos parciales).
8. Grants/revokes al final de la migración; comments explicando versionado del payload y la
   política de reintento.
9. Pasar por `sync-migration-reviewer` antes de aplicar en remoto; verificación manual del
   paso 10.

## 7. Reglas de consistencia
- Empresa derivada SIEMPRE del perfil; cada uuid del payload se valida contra ella.
- Componer `register_removal`/`fn_mount_existing_cycle`; prohibido duplicar su lógica de cierre
  de ciclo/casco o validación de posición.
- Historial completo: el lote solo agrega removals/installations y la fila de
  `tire_change_batches`; nunca borra ni edita historia.
- No hardcodear causas, posiciones ni umbrales; los valores válidos de `discard_cause` son los
  del enum, casteo con manejo de error legible.
- Mensajes de error en español con prefijo estable (tabla de `PLAN.md` 2.5).

## 8. Casos de error y concurrencia que debe manejar
- `[lote_invalido]`: versión ≠ 1; movements vacío; seq duplicado; posición duplicada como
  origen o destino; op desconocida; descarte sin causa o sin foto; mount sin `life_cycle_id`.
- `[estado_desactualizado]`: expected ≠ actual; posición esperada ocupada que ya está vacía;
  swap donde un solo lado cambió (revierte entero).
- `[no_disponible]`: montar ciclo descartado/retreaded/de otra empresa/ya montado.
- `[posicion_ocupada]`: mount hacia posición que el lote no libera y está ocupada.
- Fecha `performed_at` anterior al `installed_at` de una instalación tocada (mensaje existente
  de `register_removal`).
- Concurrencia: dos lotes sobre la misma posición → el `for update` ordenado serializa; el
  segundo debe recibir `[estado_desactualizado]` (no deadlock, no efectos parciales).
- Reintento idempotente: mismo `batch_id` tras éxito → `already_applied=true`, cero filas
  nuevas.
- Rol inspector / sin sesión → error de `fn_require_workshop_profile` (42501).

## 9. Criterios de aceptación
- Lote mixto (retén + descarte + mount + swap) sobre datos de prueba aplica atómico y la
  respuesta contiene ids reales por movimiento.
- Un movimiento inválido en un lote de N → ninguna fila nueva en removals/installations/
  batches.
- Reintento devuelve el MISMO `result` almacenado con `already_applied=true`.
- `anon` no puede ejecutar la RPC; `authenticated` sin rol de taller recibe 42501.
- `search_path` fijado y revokes verificados en el catálogo.

## 10. Comandos y recorrido manual de verificación
En SQL editor / MCP, dentro de un `DO $$ … raise exception 'TESTS_PASSED' $$` (nada persiste):
simular JWT taller, montar escenario con RPCs existentes, ejecutar un lote válido y verificar
conteos; ejecutar un lote con un movimiento inválido y verificar 0 efectos; reinvocar el lote
válido (mismo batch_id) y verificar `already_applied`. La suite formal es task_05; esta tarea
solo exige la verificación manual reproducible documentada en el handoff. El smoke test en
navegador es de la fase frontend futura.

## 11. Formato del handoff
En `STATE.md`: estado, resultado = "migración <nombre> aplicada · verificación manual OK
(lote mixto, rollback, reintento)", evidencia (bloque SQL usado + salidas). Deja a task_05 la
firma aplicada y cualquier desviación del contrato 2.5 (que debe estar aprobada y reflejada en
PLAN.md antes de continuar); deja a task_06 los textos de error definitivos.
