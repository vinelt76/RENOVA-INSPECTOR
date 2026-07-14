# task_05 — Pruebas SQL del lote: atomicidad, concurrencia, permisos, reintento

## 1. Propietario
CLAUDE

## 2. Objetivo y resultado observable
Crear `supabase/tests/tire_change_batch.test.sql` siguiendo el patrón `TESTS_PASSED` y dejarlo
en verde contra el remoto. Al terminar, una sola ejecución demuestra: atomicidad (un movimiento
inválido revierte el lote entero), bloqueo optimista, reintento idempotente, aislamiento por
empresa y rol; y queda documentada la verificación de la carrera entre dos confirmaciones
(dos sesiones).

## 3. Dependencias
- Depende de: task_04.
- Bloquea: task_07.

## 4. Archivos permitidos / prohibidos
- **Permitidos**: `supabase/tests/tire_change_batch.test.sql` (crear),
  `tasks_cambios_neumaticos/STATE.md` (su fila).
- **Prohibidos**: todo `app/`, todo `WEB/`, todo `supabase/migrations/`,
  `supabase/tests/workshop_rpcs.test.sql` y `unit_state_reads.test.sql` (no editarlos).

## 5. Contratos de entrada/salida ya verificados
**Consume:** `confirm_tire_change_batch(p_batch jsonb)` con el contrato v1 de `PLAN.md` 2.5
(payload, respuesta, códigos `[lote_invalido]`, `[estado_desactualizado]`, `[no_disponible]`,
`[posicion_ocupada]`); `tire_change_batches`; vistas de task_02 para asserts de estado; RPCs
existentes (`register_full_installation`, `register_removal`) para armar escenarios; patrón de
JWT simulado de `supabase/tests/workshop_rpcs.test.sql:76`.
**Produce:** el archivo de test (sin objetos persistentes).

## 6. Pasos de implementación
1. Leer handoffs de task_02/03/04 en `STATE.md` (nombres/firmas aplicados).
2. Escribir el `DO $$` principal con setup análogo al test existente (perfiles MOVIL/CRUZ,
   unidades con posiciones libres) y los casos B1-B9 del paso 10.
3. La prueba de concurrencia REAL (dos transacciones simultáneas) no cabe en un solo `DO`:
   escribir en el mismo archivo, como sección comentada y ejecutable, el guion de dos sesiones
   (sesión 1: `begin; select confirm_tire_change_batch(lote A); -- no commit aún`; sesión 2:
   mismo recurso → debe quedar bloqueada y, tras el commit de la 1, fallar con
   `[estado_desactualizado]`; luego rollback de todo). Ejecutarla manualmente (dos conexiones
   MCP/psql) y registrar la salida en el handoff.
4. Correr el bloque principal hasta `TESTS_PASSED`.

## 7. Reglas de consistencia
- Ningún dato de prueba persiste: todo dentro de la transacción abortada; la sección de dos
  sesiones termina en rollback explícito en ambas.
- No modificar datos reales de empresas (usar cascos `TEST-…` creados dentro del test).
- No duplicar la numeración T1-T9 del test vigente: usar B1… para evitar confusión en logs.

## 8. Casos de error y concurrencia
Los que el propio test ejercita (paso 10). Riesgo propio: dejar residuos si el test termina sin
excepción — el bloque DEBE terminar en `raise exception 'TESTS_PASSED'` incondicional.

## 9. Criterios de aceptación
- Ejecución del archivo → error `TESTS_PASSED`; cualquier otro error = fallo.
- Cobertura B1-B9 completa; cada assert cuenta filas o compara JSON devuelto, no solo "no
  explotó".
- Guion de dos sesiones ejecutado al menos una vez con evidencia en el handoff.

## 10. Comandos y recorrido manual de verificación
Pegar el bloque en el SQL editor de Supabase o vía MCP `execute_sql`. Casos mínimos:
- B1 éxito mixto: lote con retén(P_a) + mount(mismo P_a, ciclo de retén) + swap(P_b,P_c) →
  respuesta con ids; asserts: 1 instalación activa por posición, removals con reasons
  correctos, fila en `tire_change_batches`.
- B2 atomicidad: lote de 3 movimientos donde el 3° tiene `expected_life_cycle_id` erróneo →
  excepción `[estado_desactualizado]`; asserts: conteos idénticos a antes del lote y 0 filas en
  `tire_change_batches`.
- B3 reintento: reinvocar el lote de B1 (mismo batch_id) → `already_applied=true`, conteos sin
  cambio.
- B4 `[lote_invalido]`: descarte sin causa; posición duplicada como origen; version=2.
- B5 `[no_disponible]`: mount de ciclo descartado.
- B6 `[posicion_ocupada]`: mount hacia posición ocupada que el lote no libera.
- B7 aislamiento: JWT CRUZ ejecuta lote sobre unidad MOVIL → error, 0 efectos.
- B8 rol: perfil `inspector` → 42501/`no permite`.
- B9 swap desactualizado: cambiar un lado antes de confirmar → `[estado_desactualizado]`,
  ningún lado aplicado.
- Sección manual (fuera del DO): carrera de dos sesiones descrita en el paso 6.3.

## 11. Formato del handoff
En `STATE.md`: estado, resultado = "tire_change_batch.test.sql TESTS_PASSED (B1-B9) ·
concurrencia 2 sesiones verificada", evidencia (salida del test + transcripción de la carrera).
Deja a task_07 el archivo en verde como insumo del checklist.
