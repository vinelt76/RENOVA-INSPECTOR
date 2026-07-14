# task_06 — Documentación de contratos para la UI futura

## 1. Propietario
CODEX

## 2. Objetivo y resultado observable
Crear `tasks_cambios_neumaticos/CONTRATOS_UI.md`: el documento autocontenido que la fase
frontend (Fase 2) usará para implementar el modo Cambios **sin tocar el backend ni esta
conversación**. Al terminar, contiene los contratos REALES aplicados (no los propuestos):
columnas exactas de las dos vistas, firma de la RPC, payload v1 completo, un ejemplo real de
respuesta de éxito y un ejemplo por cada tipo de error, y las recetas de invocación con
`RenovaSupabase`.

## 3. Dependencias
- Depende de: task_02 y task_04 (contratos aplicados y verificados).
- Bloquea: task_07.

## 4. Archivos permitidos / prohibidos
- **Permitidos**: `tasks_cambios_neumaticos/CONTRATOS_UI.md` (crear),
  `tasks_cambios_neumaticos/STATE.md` (su fila).
- **Prohibidos**: todo `app/`, todo `WEB/`, todo `supabase/` (esta tarea no ejecuta DDL/DML;
  puede hacer SELECT/llamadas de lectura para capturar ejemplos reales, y una invocación de la
  RPC solo dentro de una transacción revertida siguiendo la receta de task_04 paso 10).

## 5. Contratos de entrada/salida ya verificados
**Consume:** `v_unit_position_state` y `v_tire_inventory_available` (task_02, columnas finales
en su handoff), `confirm_tire_change_batch(p_batch jsonb)` (task_04, contrato v1 de `PLAN.md`
2.5 con las desviaciones aprobadas que registre el handoff), patrones web existentes:
`RenovaSupabase.fetchView(name, params)` (`WEB/supabase-demo.js:24-37`),
`RenovaSupabase.supabase.rpc(...)` con `if(error) throw error` (`WEB/instalacion.html:643,717,782`),
navegación `openInspection` (`WEB/INSPECCIONES POR FECHA.html:381-389`).
**Produce:** `CONTRATOS_UI.md`.

## 6. Pasos de implementación
1. Leer los handoffs de task_02/04 en `STATE.md` y verificar contra el remoto (solo lectura)
   que columnas y firma coinciden con lo que se va a documentar.
2. Documentar cada vista: propósito, columnas con tipo y semántica (`is_empty`,
   `code_mismatch`, retén derivado), filtros REST recomendados
   (`unit_id=eq.…&order=position_number.asc`; inventario: `order=last_removed_at.desc`), y el
   detalle de que la pantalla objetivo hoy solo tiene `inspection_id`/`plate` (AUDIT 5.4):
   incluir la receta para resolver `unit_id` desde esas claves.
3. Documentar la RPC: firma, payload v1 campo por campo (obligatorio/opcional, tipos, quién
   genera `batch_id`), reglas (una posición una vez como origen/destino, mount tras retiros del
   lote, fechas), respuesta de éxito real capturada, respuesta `already_applied`, y **un ejemplo
   literal por código de error** (`[lote_invalido]`, `[estado_desactualizado]`,
   `[no_disponible]`, `[posicion_ocupada]`, 42501) con el `error.message` textual.
4. Sección "recetas web": snippet de lectura con `fetchView`, snippet de confirmación con
   `supabase.rpc('confirm_tire_change_batch', { p_batch })`, generación de UUID en navegador
   (`crypto.randomUUID()`), política de reintento (reusar el MISMO batch_id) y manejo de
   `[estado_desactualizado]` (recargar `v_unit_position_state` y rearmar). Son ejemplos de
   documentación, NO cambios en archivos de `WEB/`.
5. Sección "pendientes de Fase 2": captura/almacenamiento real de foto de descarte, smoke test
   de navegador, pruebas de UI, estados provisionales del diagrama.

## 7. Reglas de consistencia
- Documentar lo APLICADO, no lo deseado: cualquier diferencia contra `PLAN.md` se anota como
  tal con referencia al handoff que la aprobó.
- Español y términos del dominio (retén, casco, ciclo, instalación, lote).
- Ningún secreto ni URL con service_role.

## 8. Casos de error y concurrencia
Cubiertos como contenido del documento (paso 6.3); esta tarea no maneja concurrencia propia.
Riesgo propio: capturar ejemplos ejecutando escritura persistente — prohibido; toda captura de
respuesta de la RPC se hace dentro de transacción revertida.

## 9. Criterios de aceptación
- `CONTRATOS_UI.md` permite a alguien sin acceso a esta conversación implementar la Fase 2:
  contiene columnas exactas, payload completo con los 4 tipos de movimiento, respuesta de éxito
  y 5 ejemplos de error con texto literal.
- Todo verificado contra el remoto (cada bloque cita cómo se capturó).
- `STATE.md` actualizado.

## 10. Comandos y recorrido manual de verificación
- Lectura: `curl`/REST o SQL de las dos vistas con una sesión real de prueba.
- RPC: bloque `DO $$ … TESTS_PASSED` (receta de task_04 paso 10) capturando el jsonb devuelto
  con `raise notice`.
- Revisión final: leer el documento "en frío" y confirmar que no requiere ninguna fuente
  externa salvo los archivos que cita.

## 11. Formato del handoff
En `STATE.md`: estado, resultado = "CONTRATOS_UI.md completo · ejemplos capturados de remoto",
evidencia. Deja a task_07 el documento como ítem del checklist "contratos de la fase frontend
documentados".
