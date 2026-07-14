# task_03 — Tabla `tire_change_batches` + helper `fn_mount_existing_cycle`

## 1. Propietario
CLAUDE

## 2. Objetivo y resultado observable
Crear la migración con la tabla de identidad/historial de lotes y el helper interno de montaje
de un ciclo existente (contratos 2.3 y 2.4 de `PLAN.md`). Al terminar: la tabla existe con RLS
por empresa y sin escritura para clientes; el helper monta un ciclo disponible en una posición
libre y rechaza con mensaje claro todos los casos inválidos; nada de esto es aún invocable como
flujo de lote (eso es task_04).

## 3. Dependencias
- Depende de: task_01 (baseline aprobado; si marcó ajuste sobre 2.3/2.4, esperar PLAN
  corregido).
- Bloquea: task_04.

## 4. Archivos permitidos / prohibidos
- **Permitidos**:
  `supabase/migrations/20260714110000_tire_change_batches_and_mount_helper.sql` (crear;
  timestamp posterior al de task_02), `tasks_cambios_neumaticos/STATE.md` (solo su fila).
- **Prohibidos**: todo `app/`, todo `WEB/`, migraciones y tests existentes, los archivos de
  task_02/04/05.

## 5. Contratos de entrada/salida ya verificados
**Consume (existente):** `companies(id)`, `units(id)`, `profiles(id)`,
`tire_life_cycles(id, company_id, casing_id, status)`, `tire_casings(id, status)`,
`tire_installations` (+ índices parciales `active_pos_uidx`, `active_cycle_uidx`,
`20260706120000:218-221`), `fn_validate_free_position(uuid,uuid,smallint)`
(`20260712000000:62-102`), patrón RLS `select_own_company` + `current_company_id()`
(`20260710090000`).

**Produce (contrato propuesto — firma completa vinculante en `PLAN.md` 2.3 y 2.4):**
- `public.tire_change_batches` (id uuid PK generado por el cliente, company_id, unit_id,
  requested_by, batch_version smallint, performed_at date, payload jsonb, result jsonb,
  applied_at timestamptz default now()) + índice `(unit_id, applied_at desc)` + RLS
  `select_own_company` + revoke insert/update/delete/truncate a anon/authenticated.
- `public.fn_mount_existing_cycle(p_profile public.profiles, p_life_cycle_id uuid,
  p_unit_id uuid, p_position smallint, p_installed_at date, p_odometer integer default null,
  p_rtd_mm numeric default null, p_notes text default null) returns uuid` — plpgsql,
  `security definer`, `set search_path = public`, `revoke all from public, anon,
  authenticated` (helper interno: solo lo invocan otras funciones definer).

## 6. Pasos de implementación
1. Leer `BASELINE_REMOTO.md`; comprobar documentación/advisors vigentes de Supabase
   (skill/MCP) para RLS en tablas nuevas y funciones definer.
2. Migración parte A — tabla: DDL, comments (explicar que `id` nace en el cliente para
   idempotencia, y que `payload`/`result` son el registro auditable del lote), enable RLS,
   policy select, revokes, índice.
3. Migración parte B — helper: en orden:
   a. `select … from tire_life_cycles lc join tire_casings cs … where lc.id = p_life_cycle_id
      and lc.company_id = p_profile.company_id for update of lc` → error `[no_disponible]` si
      no existe/otra empresa; si `lc.status <> 'active'` o `cs.status <> 'active'` → error
      `[no_disponible]` con el estado actual en el mensaje.
   b. Si existe instalación activa del ciclo → error `[no_disponible]` indicando placa/posición
      donde está montado.
   c. `perform public.fn_validate_free_position(p_profile.company_id, p_unit_id, p_position)`
      (reutiliza mensajes existentes de unidad/posición/ocupada).
   d. `insert into tire_installations (company_id, life_cycle_id, unit_id, position_number,
      installed_at, odometer_at_install, rtd_at_install_mm, installed_by, notes)` y devolver el
      id. `rtd_at_install_mm = coalesce(p_rtd_mm, lc.otd_mm)` solo si es la primera instalación
      del ciclo; si el ciclo ya rodó, no usar OTD como fallback (dejar null si no vino) —
      documentar en comment.
4. Verificar mensajes de error en español con prefijos estables (`[no_disponible]`,
   los de `fn_validate_free_position` ya existen).
5. Pasar la migración por el agente `sync-migration-reviewer` antes de aplicarla en remoto.
   Verificación posterior mínima: ver paso 10.

## 7. Reglas de consistencia
- La empresa NUNCA viaja del cliente: el helper la recibe en `p_profile` (validado aguas
  arriba por `fn_require_workshop_profile`).
- Historial: el helper solo inserta; jamás toca instalaciones cerradas ni removals.
- Los índices parciales existentes quedan como candado final: no reemplazar sus garantías con
  lógica propia, solo anteponer mensajes claros.
- No hardcodear catálogos, posiciones ni umbrales.
- Idempotencia de migración: `create table if not exists` NO (la tabla es nueva y única); pero
  la migración debe fallar limpio si ya existe (task_01 confirmó nombre libre).

## 8. Casos de error y concurrencia
- Ciclo de otra empresa / inexistente / descartado / retreaded / casco descartado / ya montado
  → `[no_disponible]`, sin efectos.
- Posición inexistente en la config u ocupada → mensajes de `fn_validate_free_position`.
- Carrera montar-montar el mismo ciclo: el `for update` del ciclo serializa; el segundo ve la
  instalación activa nueva y falla. Carrera sobre la misma posición: la resuelve
  `active_pos_uidx` (unique_violation) — se prueba formalmente en task_05.

## 9. Criterios de aceptación
- Migración aplica limpia; `\d public.tire_change_batches` muestra PK, RLS habilitada, policy y
  sin privilegios de escritura para anon/authenticated.
- `fn_mount_existing_cycle` no es ejecutable por `authenticated` directamente
  (`has_function_privilege` = false) y sí ejecuta correctamente dentro de un `DO` con rol
  privilegiado de prueba.
- Ningún archivo fuera de los permitidos cambió.

## 10. Comandos y recorrido manual de verificación
En SQL editor / MCP (dentro de una transacción que se revierte, patrón `TESTS_PASSED`
informal):
1. Simular JWT de un perfil taller; crear ciclo disponible retirando a retén uno de prueba
   (RPCs existentes T1/T6 del test vigente sirven de receta).
2. `select public.fn_mount_existing_cycle(perfil, ciclo, unidad, posicion_libre, current_date)`
   → devuelve uuid; la fila aparece activa en `tire_installations`.
3. Repetir sobre posición ocupada y sobre ciclo descartado → errores esperados.
4. `select has_function_privilege('authenticated', 'public.fn_mount_existing_cycle(public.profiles,uuid,uuid,smallint,date,integer,numeric,text)', 'execute')` → false.
5. `raise exception 'TESTS_PASSED'` para revertir.
Las pruebas formales y de concurrencia quedan en task_05.

## 11. Formato del handoff
En `STATE.md`: estado, resultado = "migración <nombre> aplicada · helper verificado manualmente
· privilegios correctos", evidencia (queries + salidas del paso 10). Deja a task_04: nombres y
firma exacta de tabla y helper tal como quedaron aplicados.
