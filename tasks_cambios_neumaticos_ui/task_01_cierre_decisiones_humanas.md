# task_01 — Cierre de decisiones humanas bloqueantes

1. **Propietario y alcance**: CLAUDE (coordinación con el humano). Alcance: resolver o aceptar
   explícitamente las decisiones que bloquean tareas. **No** implementa código.
2. **Objetivo y resultado observable**: `DECISIONES.md` actualizado con las respuestas humanas a
   las Decisiones 3 (Storage) y 10 (smoke), y confirmación de 1, 2, 5, 6, 8. Cada decisión cerrada
   pasa de ABIERTA/BLOQUEA a RESUELTA con la elección registrada.
3. **Dependencias**: ninguna. **Bloquea**: `task_03` y `task_12` (Decisión 3); `task_16` (Decisión
   10); orienta 09/10/13.
4. **Decisiones que aplica**: todas las de `DECISIONES.md`. No la bloquea ninguna.
5. **Archivos permitidos**: `tasks_cambios_neumaticos_ui/DECISIONES.md`, `STATE.md` (su fila).
   **Solo lectura**: `AUDIT.md`, `PLAN.md`, `CONTRATOS_UI.md`. **Prohibido**: cualquier archivo de
   `WEB/`, `app/`, `supabase/`.
6. **Estado inicial verificado**: Decisión 3 y 10 marcadas **BLOQUEA (humano)**
   (`DECISIONES.md` tabla); Storage remoto sin buckets (`AUDIT.md §4`, §9); proyecto único
   productivo (`AUDIT.md §9`).
7. **Contratos de entrada/salida**: entrada = las 6 preguntas humanas de `DECISIONES.md`. Salida =
   texto de resolución por decisión (elección + justificación breve).
8. **Pasos**: (1) Presentar al humano las 6 preguntas concretas. (2) Registrar cada respuesta en la
   fila y el detalle de la decisión. (3) Para Storage, fijar bucket/privacidad/path/límite/momento
   de upload. (4) Para smoke, fijar unidad/usuario de prueba y política de limpieza. (5) Actualizar
   `STATE.md` de `task_03`/`task_12`/`task_16` a PENDIENTE cuando su decisión quede resuelta.
9. **Estados**: si el humano no responde una decisión, su tarea sigue BLOQUEADA; el resto del plan
   avanza. No inventar la decisión.
10. **Consistencia/seguridad**: no exponer secretos ni credenciales de los usuarios de prueba en
    `DECISIONES.md` (referenciar el vault humano, `knowledge/ai/08:24`).
11. **Pruebas automatizadas**: N/A (tarea documental).
12. **Smoke test real**: N/A.
13. **Criterios de aceptación**: Decisiones 3 y 10 tienen elección registrada o quedan
    explícitamente diferidas; ninguna tarea bloqueada avanza sin su decisión.
14. **Comandos de verificación**: `npm run docs:check` no aplica (fuera de `knowledge/`); revisión
    visual del diff de `DECISIONES.md`.
15. **Rollback**: revertir el diff documental si una decisión se re-abre.
16. **Handoff**: actualizar la fila `task_01` en `STATE.md` a APROBADO ✓ con la lista de decisiones
    cerradas y las diferidas.
