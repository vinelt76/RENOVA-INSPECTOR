# task_07 — Revisión cruzada final de integración

## 1. Propietario
CLAUDE

## 2. Objetivo y resultado observable
Ejecutar el checklist de cierre contra el remoto y el repo, y dejar el veredicto en
`tasks_cambios_neumaticos/REVISION_FINAL.md`. No es una tarea de "arreglar lo pendiente": si un
ítem falla, se registra la evidencia, se marca la tarea responsable como EN CORRECCIÓN ⚠ en
`STATE.md` y esta revisión se repite tras la corrección.

## 3. Dependencias
- Depende de: task_02, task_05, task_06 (es la última tarea).
- Bloquea: el arranque de la Fase 2 (frontend futuro).

## 4. Archivos permitidos / prohibidos
- **Permitidos**: `tasks_cambios_neumaticos/REVISION_FINAL.md` (crear),
  `tasks_cambios_neumaticos/STATE.md` (su fila + marcar EN CORRECCIÓN ⚠ las tareas con fallas).
- **Prohibidos**: todo `app/`, todo `WEB/`, todo `supabase/` (no corrige código: solo lee,
  ejecuta tests y documenta).

## 5. Contratos de entrada/salida ya verificados
Consume TODO lo producido: `BASELINE_REMOTO.md`, las 3 migraciones nuevas, los 2 tests nuevos,
`CONTRATOS_UI.md`, `PLAN.md` (contratos 2.1-2.5) y `AUDIT.md` (derivas 5.1-5.6). Produce
`REVISION_FINAL.md`.

## 6. Pasos de implementación
Recorrer el checklist del paso 9 ítem por ítem, con evidencia (query/comando + salida) por
ítem. Cerrar con veredicto global: APTO PARA FASE 2 o lista de correcciones.

## 7. Reglas de consistencia
- Revisión independiente: re-ejecutar las verificaciones, no confiar en los handoffs.
- Un conflicto intención/implementación detectado acá se documenta y detiene el veredicto; no
  se corrige en silencio (regla CLAUDE.md).

## 8. Casos de error y concurrencia
Verifica los de las tareas anteriores (checklist); no introduce propios.

## 9. Criterios de aceptación (checklist a ejecutar)
1. **Contratos respetados**: columnas reales de `v_unit_position_state` y
   `v_tire_inventory_available` y firma real de `confirm_tire_change_batch` coinciden con
   `PLAN.md` 2.1/2.2/2.5 (o con desviaciones aprobadas y documentadas en handoffs y
   `CONTRATOS_UI.md`).
2. **RLS y permisos**: tabla `tire_change_batches` con RLS + policy por empresa y sin escritura
   de clientes; vistas nuevas `security_invoker=true`, sin grant a `anon`;
   `fn_mount_existing_cycle` no ejecutable por `authenticated`; RPC de lote con revoke
   public/anon, grant authenticated, `search_path` fijo. Verificar en catálogo remoto
   (`pg_policies`, `information_schema.role_table_grants`, `has_function_privilege`,
   `pg_get_functiondef`).
3. **Atomicidad e idempotencia**: `supabase/tests/tire_change_batch.test.sql` → `TESTS_PASSED`
   re-ejecutado por el revisor; evidencia de la carrera de dos sesiones presente en el handoff
   de task_05.
4. **Lecturas**: `supabase/tests/unit_state_reads.test.sql` → `TESTS_PASSED`; el test previo
   `supabase/tests/workshop_rpcs.test.sql` sigue en `TESTS_PASSED` (no se rompió nada
   existente).
5. **Historial e invariantes**: ninguna migración nueva hace UPDATE/DELETE de historia; los
   índices parciales `active_pos_uidx`/`active_cycle_uidx`/`tire_life_cycles_active_uidx`
   siguen existiendo; nada hardcodea catálogos/umbrales/posiciones.
6. **Orden de migraciones**: timestamps nuevos posteriores a `20260712010000` y en orden
   02 → 03 → 04; aplicadas en remoto; advisors de Supabase sin hallazgos nuevos atribuibles a
   estos objetos.
7. **`STATE.md` consistente**: todas las filas con estado/resultado/evidencia; sin tareas
   colgadas.
8. **Contratos frontend documentados**: `CONTRATOS_UI.md` completo (criterio 9 de task_06) y
   coherente con lo aplicado.
9. **Exclusiones respetadas**: `git status`/diff confirman que nadie tocó `app/` ni `WEB/`.
10. **Derivas del AUDIT**: 5.2 (DDL no versionado) y 5.3 (specs sin reglas de cambios) tienen
    disposición registrada (resueltas, aceptadas o escaladas a humano) — sin resolver en
    silencio.

## 10. Comandos y recorrido manual de verificación
- Re-ejecutar los tres archivos de `supabase/tests/` (esperado: `TESTS_PASSED` cada uno).
- Queries de catálogo del ítem 2 vía MCP (solo lectura).
- `git log --oneline -10` y `git status` para el ítem 9.
- Advisors vía MCP para el ítem 6.
El smoke test en navegador NO forma parte de esta revisión (fase frontend futura); dejarlo
anotado como pendiente de Fase 2 en `REVISION_FINAL.md`.

## 11. Formato del handoff
En `STATE.md`: estado APROBADO ✓ con resultado = "REVISION_FINAL.md · veredicto APTO PARA
FASE 2" (o EN CORRECCIÓN ⚠ + lista de ítems fallados y tareas responsables). Deja al humano y a
la Fase 2: `REVISION_FINAL.md` + `CONTRATOS_UI.md` como puerta de entrada. Recomendar (sin
ejecutarlo) actualizar `knowledge/ai/05` y `07` según `knowledge/ai/14 - Mantenimiento
documental.md` y correr `npm run docs:check`, dado que hay contratos y APIs SQL nuevos.
