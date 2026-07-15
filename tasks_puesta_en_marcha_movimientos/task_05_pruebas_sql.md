# task_05 — Pruebas SQL de línea base y no regresión

**1. Propietario**: CLAUDE.

**2. Objetivo y resultado observable**
Probar el primer montaje y el gate con datos **sintéticos y efímeros**. Resultado observable:
`supabase/tests/baseline_mount.test.sql` corre contra el remoto y termina con
`ERROR: P0001: TESTS_PASSED`, **sin dejar una sola fila** — el patrón auto-reversible de
`supabase/tests/workshop_rpcs.test.sql` (`BASELINE_REMOTO.md:212-217`).

**3. Dependencias y tareas que bloquea**
Depende de: `task_04` **cerrada**. Bloquea: `task_06`.

**4. Archivos**
- Permitidos (exclusivos): `supabase/tests/baseline_mount.test.sql`.
- Prohibidos: **las 4 suites vigentes** (`workshop_rpcs.test.sql`, `tire_change_batch.test.sql`,
  `unit_state_reads.test.sql`, `tire_discard_photos.test.sql`) — se **ejecutan sin editar**: que
  pasen intactas es el criterio de no regresión. También `supabase/migrations/**` (si algo está mal,
  vuelve a `task_03`/`task_04` `EN CORRECCIÓN`) y `WEB/**`.

**5. Contratos**
Prueba los de `task_03` y `task_04`. No agrega ninguno.

**6. Pasos**
1. Escribir el test como un `DO $$ … $$` que termina con `raise exception 'TESTS_PASSED'`
   (auto-revierte: **ningún dato queda**).
2. Verificación inicial de precondiciones con `to_regtype`/`to_regproc`: si faltan los objetos de
   `task_03`/`task_04`, fallar con un mensaje claro, no con "objeto inexistente".
3. Armar el fixture dentro del propio `DO`: empresa, perfil de taller, config, unidad, posiciones,
   inspección y mediciones. Placas evidentemente de prueba.
4. Casos obligatorios:

   **Procedencia y helper (`task_03`)**
   - **T1** `register_full_installation` sigue creando casco+ciclo+instalación con
     `origin='workshop'` y `source_measurement_id` NULL. **Su comportamiento no cambió.**
   - **T2** El `check` rechaza un `insert` directo con `origin='baseline'` y
     `source_measurement_id` NULL.
   - **T3** `v_unit_position_state.baseline_pending` = `true` en una posición vacía con código en la
     última inspección; `false` si no hay código; `false` si hay instalación activa.
   - **T4** Las columnas `last_*` traen la evidencia correcta (código, marca, medida, condición,
     RTD, odómetro) de **la última** inspección, no de una anterior.

   **Primer montaje (`task_04`)**
   - **T5** `confirm_baseline_mount` con `casing_code` → 1 casco + 1 ciclo + 1 instalación, las tres
     con `origin='baseline'`, `source_measurement_id` poblado, e
     `inspection_measurements.life_cycle_id` de la medición fuente apuntando al ciclo nuevo.
   - **T6** Mismo `batch_id` otra vez → `already_applied=true`, **cero filas nuevas**. Idempotencia.
   - **T7** `batch_id` nuevo, misma posición → `[posicion_ocupada]`.
   - **T8** `casing_code` que ya existe en la empresa → `[codigo_en_uso]`, cero filas.
   - **T9** Con `life_cycle_id` de un ciclo del retén → monta, `origin='baseline'`, sin crear casco.
   - **T10** `life_cycle_id` ya montado → `[no_disponible]`.
   - **T11** `source_measurement_id` de otra unidad/posición → `[evidencia_invalida]`, cero filas.
   - **T12** `condition='R1'` sin `retread_design` → `[lote_invalido]` (paridad con
     `register_full_installation:148-150`).
   - **T13** Ni `casing_code` ni `life_cycle_id`, y ambos a la vez → `[lote_invalido]` en los dos.
   - **T14** `seq` duplicado y posición repetida → `[lote_invalido]`.
   - **T15** Perfil sin rol de taller → `[sin_permiso]`; unidad de otra empresa → `[sin_permiso]`.
   - **T16** Lote de 4 mounts de un bus completo → 4 instalaciones en una transacción; si el 4°
     falla, **ninguna** queda (todo o nada).
   - **T17** `v_tire_inventory_available` **no crece** tras T5: ciclo e instalación nacen juntos
     (`AUDIT.md §6`).

   **Gate (`task_04`)**
   - **T18** `confirm_tire_change_batch` con `mount` sobre posición `baseline_pending` →
     `[linea_base_pendiente]`, `22023`, cero escrituras.
   - **T19** `mount` sobre posición vacía **sin** evidencia → **funciona** como antes.
   - **T20** Tras un `confirm_baseline_mount` en esa posición, un `swap` posterior con el lote
     normal → **funciona**: la línea base habilitó la operación.
   - **T21** `send_to_retention` / `discard` / `swap` no se ven afectados por el gate.

5. Cada caso afirma explícitamente con `assert` o `raise exception`, comparando **qué esperaba vs.
   qué obtuvo**.

**7. Invariantes**
- El test **se auto-revierte**: `raise exception 'TESTS_PASSED'` al final. Si un caso falla, el
  `raise` propio también revierte. Nunca queda una fila.
- **Cero datos reales**: no leer ni escribir sobre placas de CIVA/MÓVIL BUS/ITTSABUS ni sobre
  `QA-CN16`.
- **Las 4 suites vigentes se ejecutan sin editar.** Si alguna necesita un cambio, es una regresión:
  `task_03`/`task_04` van a `EN CORRECCIÓN`.
- La concurrencia real (dos backends) no se simula en un `DO` de un solo backend: los índices-candado
  la cubren y `task_04` la razona. **Documentar la limitación** en el encabezado del test en vez de
  fingir que se prueba.

**8. Casos de error, ambigüedad y concurrencia**
- Si un `assert` falla: el mensaje dice **qué caso**, qué esperaba y qué obtuvo.
- Si el efímero no tiene las migraciones aplicadas → mensaje claro de precondición (paso 2).
- Caída de conexión antes del `raise` → Postgres revierte la transacción abierta igual. Verificar los
  conteos de todos modos.

**9. Criterios de aceptación**
- La corrida termina con `ERROR: P0001: TESTS_PASSED`.
- Tras la corrida, en el remoto: cascos/ciclos/instalaciones = **36 / 37 / 37**, idénticos a
  `AUDIT.md §4.1`. Nada persistió.
- Los 21 casos están presentes y afirman.
- Las 4 suites vigentes terminan en `TESTS_PASSED` dentro del mismo efímero, sin editarlas.

**10. Comandos y verificación**
```
MCP execute_sql sobre fbxupwwgiebhlciqftpw, en UNA transacción:
  begin;
    <20260716100000_baseline_provenance_and_helper.sql>
    <20260716110000_baseline_mount_rpc_and_gate.sql>
    <supabase/tests/baseline_mount.test.sql>      -- termina en TESTS_PASSED
  rollback;
```
Después, por separado y también en efímero, las 4 suites vigentes sobre las mismas migraciones.
Verificación final obligatoria: conteos 36/37/37.

**11. Rollback / limpieza**
La tarea no persiste datos: el test se auto-revierte por diseño. Verificar los conteos igual.

**12. Handoff a `STATE.md`**
Fila `task_05` → `Resultado`: los 21 casos con su veredicto, y **cualquier discrepancia entre el
contrato documentado en `PLAN.md §4.2` y lo que el RPC hace de verdad** (los tests son la autoridad
sobre el estado implementado — `knowledge/ai/00 - LEER PRIMERO.md:39-41`). `Revisión`: la línea
literal `ERROR: P0001: TESTS_PASSED`, el `TESTS_PASSED` de las 4 suites vigentes sin editar, y los
conteos 36/37/37 que prueban que no persistió nada.
