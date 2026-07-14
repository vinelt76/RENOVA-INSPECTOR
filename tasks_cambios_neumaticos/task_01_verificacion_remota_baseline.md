# task_01 — Verificación remota y baseline

## 1. Propietario
CLAUDE

## 2. Objetivo y resultado observable
Contrastar el estado REAL del proyecto Supabase remoto contra las migraciones locales y contra
los contratos propuestos de `tasks_cambios_neumaticos/PLAN.md`, y dejar la evidencia en un
archivo nuevo `tasks_cambios_neumaticos/BASELINE_REMOTO.md`. Al terminar se puede leer en ese
archivo: DDL real de los objetos no versionados, advisors vigentes, grants/RLS reales de las
tablas y RPCs que el plan toca, y un veredicto por cada contrato propuesto ("compatible" o
"requiere ajuste del PLAN", con evidencia).

## 3. Dependencias
- Depende de: ninguna.
- Bloquea: task_02, task_03 (y transitivamente todas).

## 4. Archivos permitidos / prohibidos
- **Permitidos**: `tasks_cambios_neumaticos/BASELINE_REMOTO.md` (crear),
  `tasks_cambios_neumaticos/STATE.md` (solo su fila).
- **Prohibidos**: todo `app/`, todo `WEB/`, todo `supabase/` (esta tarea es 100% lectura del
  remoto y del repo; NO aplica migraciones ni ejecuta DDL/DML — solo SELECT/consultas de
  catálogo).

## 5. Contratos de entrada/salida ya verificados
- Entrada: `PLAN.md` secciones 2.1-2.5 (contratos propuestos) y `AUDIT.md` sección 5 (derivas
  1-6). Objetos existentes a verificar: tablas/enums/índices de
  `supabase/migrations/20260706120000_demo_vertical_slice.sql`; RLS de
  `20260710090000_dashboard_public_rls.sql`; RPCs y helpers de
  `20260712000000_workshop_tire_operations_rpcs.sql`; vistas de `20260710200000` y
  `20260710220000`.
- Salida: `BASELINE_REMOTO.md` con las secciones listadas en el paso 6.

## 6. Pasos de implementación
1. Consultar la documentación vigente de Supabase (skill/MCP `supabase` disponible) sobre RLS,
   security definer/invoker y advisors antes de interpretar resultados.
2. Con acceso de LECTURA al proyecto (MCP de Supabase; el ID histórico en knowledge es
   `fbxupwwgiebhlciqftpw`, confirmarlo): listar tablas, vistas, funciones y enums de `public`
   y compararlos con las migraciones locales en orden. Registrar cualquier objeto remoto sin
   migración local y cualquier migración local no aplicada.
3. Volcar el DDL real de `v_inventory_status`, `v_casing_history_summary`,
   `v_casing_installations`, `v_casing_inspections` (deriva 5.2 del AUDIT): definición,
   `security_invoker`, grants. Recomendar si `v_tire_inventory_available` (PLAN 2.2) convive o
   reemplaza — sin tocar nada que `historial-neumatico.html` consuma.
4. Verificar RLS/grants REALES (no solo los de migraciones) de: `tire_casings`,
   `tire_life_cycles`, `tire_installations`, `tire_removals`, `units`, `tire_positions`,
   `profiles`; y EXECUTE reales de `register_removal`, `transfer_tire`,
   `register_full_installation`, `fn_require_workshop_profile`, `fn_validate_free_position`.
5. Correr los advisors del proyecto (seguridad y performance) y registrar los hallazgos que
   toquen los objetos del plan.
6. Confirmar que `supabase/tests/workshop_rpcs.test.sql` pasa hoy contra el remoto
   (resultado esperado: error `TESTS_PASSED`). Si falla, documentar y detenerse: es un
   conflicto intención/implementación que se muestra, no se arregla en silencio.
7. Emitir veredicto por contrato del PLAN (2.1-2.5): nombres libres de colisión, tipos
   compatibles, sin conflicto con objetos remotos. Si algo requiere ajuste, describir el ajuste
   propuesto y marcarlo — task_03/task_04 no arrancan hasta que el humano apruebe la
   corrección del PLAN.

## 7. Reglas de consistencia
- Solo lectura: nada de DDL/DML remoto, ni siquiera "temporal".
- No exponer `service_role` ni secretos en `BASELINE_REMOTO.md`.
- Conflictos intención/implementación se documentan con evidencia, no se resuelven.

## 8. Casos de error y concurrencia
No aplica (tarea de lectura). Caso de error propio: sin acceso MCP al proyecto → documentar el
bloqueo en `STATE.md` y qué verificaciones quedaron pendientes (las tareas siguientes deben
asumir "no verificado" explícitamente, nunca "verificado").

## 9. Criterios de aceptación
- `BASELINE_REMOTO.md` existe con: inventario remoto vs local, DDL de objetos no versionados,
  RLS/grants reales, resultado de advisors, resultado del test existente, y veredicto por
  contrato 2.1-2.5.
- Cada afirmación tiene evidencia (query usada + resultado resumido).
- Ninguna modificación fuera de los archivos permitidos.

## 10. Comandos y recorrido manual de verificación
- Vía MCP Supabase (solo lectura): `select * from pg_views where schemaname='public'`,
  `pg_policies`, `information_schema.role_table_grants`,
  `pg_proc`/`pg_get_functiondef(oid)` para las funciones, y el listado de advisors.
- Test existente: ejecutar el contenido de `supabase/tests/workshop_rpcs.test.sql` en el SQL
  editor / MCP `execute_sql`; esperado: error con texto `TESTS_PASSED`.

## 11. Formato del handoff
En `STATE.md`: estado APROBADO ✓ (o EN CORRECCIÓN ⚠ si algún contrato requiere ajuste),
resultado = "BASELINE_REMOTO.md · N derivas confirmadas · contratos 2.1-2.5: veredicto".
Deja a task_02 y task_03: `BASELINE_REMOTO.md` como fuente de nombres/grants confirmados.
