# task_16 — Smoke real E2E + documentación + revisión cruzada final

1. **Propietario y alcance**: CLAUDE (revisión independiente). Smoke de navegador con sesión real,
   actualización documental y checklist final de la fase. **No** es una tarea genérica de "arreglar
   pendientes": es la puerta de aprobación.
2. **Objetivo y resultado observable**: `REVISION_FINAL.md` con veredicto y evidencia real de
   navegador (lote mixto confirmado, recarga persistente, consola limpia, sin secretos), y
   `knowledge/ai/05`/`07` actualizados; `npm run docs:check` verde.
3. **Dependencias**: `task_14`, `task_15`. **Bloquea**: cierre de la fase.
4. **Decisiones**: **Decisión 10 RESUELTA** — unidad/usuario de taller de prueba dedicada en prod +
   limpieza. Desbloqueada. **Insumo humano pendiente**: la placa/unidad de prueba y las credenciales
   del usuario de taller (desde el vault privado, nunca en el repo) deben entregarse antes de correr
   la confirmación real.
5. **Archivos permitidos**: `tasks_cambios_neumaticos_ui/REVISION_FINAL.md`,
   `knowledge/ai/05 - Datos y Supabase.md`, `knowledge/ai/07 - Web dashboards y taller.md`, y la
   columna "Revisión" de `STATE.md`. **Solo lectura**: todo `WEB/tire-change/`, `CONTRATOS_UI.md`.
   **Prohibido**: modificar los módulos (los hallazgos se devuelven como ⚠ a su tarea dueña).
6. **Estado inicial verificado**: la fase backend cerró APTO (`REVISION_FINAL.md` de
   `tasks_cambios_neumaticos/`); mantenimiento documental en `knowledge/ai/14`; proyecto productivo
   único (`AUDIT.md §9`).
7. **Contratos**: verificar contra `CONTRATOS_UI.md` (canónico) sin contradecirlo.
8. **Pasos**: (1) Smoke real con sesión de rol de taller: abrir unidad → modo Cambios → armar
   **lote mixto** (retén + descarte con foto real + montaje + swap) → confirmar → recargar y
   verificar persistencia del estado real. (2) Provocar al menos un error real
   (`[estado_desactualizado]` o `[sin_permiso]`) y verificar el manejo. (3) Verificar recarga con
   borrador editable y con sellado pendiente; retry idempotente (mismo `batch_id`). (4) Confirmar
   consola sin errores y **sin secretos/datos sensibles en logs**. (5) Verificar no-regresión del
   modo Inspección. (6) Actualizar `knowledge/ai/05` (vistas/datos) y `knowledge/ai/07`
   (operaciones de taller) y correr `npm run docs:check`. (7) Limpiar los datos de prueba según
   Decisión 10.
9. **Estados**: cubrir carga, vacío, error, éxito y recuperación en el recorrido real.
10. **Consistencia/seguridad**: no ensuciar producción fuera de la unidad de prueba acordada; no
    exponer secretos; smoke solo con la clave publicable/anon prevista.
11. **Pruebas**: la suite (`task_15`) debe estar verde antes de este smoke.
12. **Smoke real (checklist obligatorio)**: los casos del prompt de la fase — unidades 6/8/vacía;
    0 filas/no autorizada; retén/descarte/montaje/swap; lote mixto; ciclo que desaparece; timeout
    con mismo `batch_id`; edición → nuevo `batch_id`; recarga con borrador y con sellado; los 5+
    errores; fallo/cancelación de foto (huérfano limpiado); Realtime durante edición;
    `code_mismatch`; teclado/foco/Escape/táctil; retorno a Inspección sin contaminar; consola sin
    errores ni secretos.
13. **Aceptación**: veredicto APTO solo con evidencia de navegador real, consola limpia, estado
    persistido tras recarga y ausencia de regresiones en Inspección. Cualquier fallo se devuelve
    como ⚠ a la tarea dueña.
14. **Comandos**: `npm run docs:check`; servir `WEB/` y recorrer el checklist; `cd WEB/tire-change
    && npm test` verde.
15. **Rollback/recuperación**: limpiar objetos de Storage y (si se acordó) la historia de prueba;
    documentar qué quedó.
16. **Handoff**: fila `task_16` a APROBADO ✓ con el veredicto, la evidencia del smoke y la lista de
    ⚠ devueltos (si los hay).
