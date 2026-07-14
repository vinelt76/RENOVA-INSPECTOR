# task_02 — Vistas de lectura: estado de posiciones e inventario/retén

## 1. Propietario
CODEX

## 2. Objetivo y resultado observable
Crear la migración con `v_unit_position_state` y `v_tire_inventory_available` (contratos 2.1 y
2.2 de `PLAN.md`) y sus pruebas SQL de lectura. Al terminar: consultando
`v_unit_position_state` con la sesión de un usuario se ven TODAS las posiciones de la
configuración de sus unidades (incluidas vacías, `is_empty=true`) con la instalación activa y
la última inspección; `v_tire_inventory_available` lista los ciclos disponibles en retén de su
empresa; el test nuevo termina en `TESTS_PASSED`.

## 3. Dependencias
- Depende de: task_01 (baseline; si task_01 marcó ajuste sobre 2.1/2.2, esperar el PLAN
  corregido).
- Bloquea: task_06, task_07 (y la Fase 2 futura).

## 4. Archivos permitidos / prohibidos
- **Permitidos**:
  `supabase/migrations/20260714100000_unit_position_state_and_inventory_views.sql` (crear;
  ajustar timestamp para que sea posterior a la última migración existente),
  `supabase/tests/unit_state_reads.test.sql` (crear),
  `tasks_cambios_neumaticos/STATE.md` (solo su fila).
- **Prohibidos**: todo `app/`, todo `WEB/`, cualquier otra migración o test existente,
  `v_inventory_status` y vistas `v_casing_*` remotas (no tocarlas: `historial-neumatico.html`
  depende de ellas).

## 5. Contratos de entrada/salida ya verificados
**Consume (existente):** `units(id, company_id, plate, config_id)`,
`tire_positions(config_id, position_number, side, axle_id, is_ground)`,
`axles(id, axle_number, axle_type)`,
`tire_installations(id, life_cycle_id, unit_id, position_number, installed_at,
odometer_at_install, rtd_at_install_mm, removed)`,
`tire_life_cycles(id, casing_id, cycle_number, condition, retread_design, otd_mm, status)`,
`tire_casings(id, code, brand_name, model_name, size_name, status)`,
`tire_removals(installation_id, removed_at, reason, rtd_at_removal_mm)`,
`inspections(id, unit_id, inspected_on)` +
`inspection_measurements(inspection_id, position_number, tire_code, rtd_movi_mm, pressure_psi)`
— todo de `supabase/migrations/20260706120000_demo_vertical_slice.sql`.

**Produce (contrato propuesto, firma completa en `PLAN.md` 2.1 y 2.2 — copiar columnas y tipos
de ahí, son vinculantes):** `public.v_unit_position_state` y
`public.v_tire_inventory_available`, ambas `with (security_invoker = true)`,
`grant select … to authenticated` y **ningún grant a anon/public**.

## 6. Pasos de implementación
1. Leer `BASELINE_REMOTO.md` (nombres confirmados, colisiones) y `PLAN.md` 2.1/2.2.
2. Comprobar la documentación vigente de Supabase (skill/MCP) sobre `security_invoker` en
   vistas y advisors de vistas expuestas.
3. Escribir la migración: las dos vistas, comentarios (`comment on view`) explicando semántica
   de `is_empty`, `code_mismatch` y "retén derivado", y los grants/revokes.
   - `v_unit_position_state`: base = `units join tire_positions using-config`; LEFT JOIN
     instalación activa (`not removed`); LEFT JOIN ciclo/casco; LEFT JOIN LATERAL última
     medición de esa unidad+posición (por `inspected_on desc`). `code_mismatch` = hay
     instalación activa y `last_inspection_tire_code is distinct from casing_code` (con
     normalización trim/upper como criterio; documentarlo en el comment).
   - `v_tire_inventory_available`: ciclos `active` de cascos `active` sin instalación activa;
     LEFT JOIN LATERAL último `tire_removals` del ciclo (vía sus installations, por
     `removed_at desc`) para `last_removed_at/last_removal_reason/last_rtd_mm`. Incluir ciclos
     que nunca se instalaron (columnas de retiro NULL).
4. Escribir `supabase/tests/unit_state_reads.test.sql` siguiendo el patrón `DO $$ …
   TESTS_PASSED` de `supabase/tests/workshop_rpcs.test.sql` (JWT simulado con
   `set_config('request.jwt.claims', …)`).
5. Aplicar la migración en remoto SOLO tras pasar por el agente `sync-migration-reviewer`
   (regla de CLAUDE.md para migraciones sensibles) y correr el test.

## 7. Reglas de consistencia
- RLS por empresa intacta: vistas `security_invoker=true`; jamás `security definer` ni grant a
  `anon`.
- Nada hardcodeado: ni número de posiciones, ni umbrales, ni nombres de empresa.
- No modificar tablas ni datos: esta migración solo crea vistas.
- No romper vistas existentes (no usar `drop … cascade` sobre objetos ajenos).

## 8. Casos de error y concurrencia
- Posición sin instalación y sin inspección → fila presente con todos los null y
  `is_empty=true` (nunca desaparece).
- Unidad con inspecciones legado sin instalaciones (Excel) → `is_empty=true` +
  `last_inspection_tire_code` poblado (la discrepancia queda visible; AUDIT 5.5).
- Ciclo con más de una instalación histórica → el retiro mostrado es el último.
- Concurrencia: no aplica (lecturas); pero el test debe verificar que un retiro vía
  `register_removal` se refleja de inmediato en ambas vistas dentro de la misma transacción.

## 9. Criterios de aceptación
- Migración aplica limpia sobre el esquema actual (y es re-ejecutable con `create or replace
  view` para las vistas).
- Test en `TESTS_PASSED` cubriendo como mínimo T1-T6 del paso 10.
- `select` de ambas vistas con JWT de empresa A no devuelve ninguna fila de empresa B.
- `anon` no puede leer ninguna de las dos vistas.

## 10. Comandos y recorrido manual de verificación
Ejecutar `supabase/tests/unit_state_reads.test.sql` (SQL editor / MCP `execute_sql`);
esperado: error `TESTS_PASSED`. Casos mínimos dentro del test:
- T1: unidad con config de N posiciones → exactamente N filas en `v_unit_position_state`.
- T2: instalar (RPC existente `register_full_installation`) → la fila de esa posición pasa a
  `is_empty=false` con casing_code correcto.
- T3: `register_removal(reason='retention')` → la posición vuelve a `is_empty=true` y el ciclo
  aparece en `v_tire_inventory_available` con `last_removal_reason='retention'`.
- T4: `register_removal(reason='discard')` sobre otro ciclo → NO aparece en inventario.
- T5: JWT de la empresa CRUZ → 0 filas de unidades/ciclos MOVIL en ambas vistas.
- T6: posición con medición de inspección y sin instalación → `is_empty=true` y
  `last_inspection_tire_code` no nulo.
El smoke test en navegador corresponde a la fase frontend futura, no a esta tarea.

## 11. Formato del handoff
En `STATE.md`: estado, resultado = "migración <nombre> aplicada · unit_state_reads.test.sql
TESTS_PASSED · grants verificados", evidencia (salida del test). Deja a task_04/task_06: los
nombres de columna definitivos de ambas vistas (si difirieron del PLAN, anotarlo — task_06
documenta lo real).
