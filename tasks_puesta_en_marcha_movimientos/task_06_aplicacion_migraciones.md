# task_06 — Aplicación aprobada de las migraciones

> ⚠ **Esta tarea escribe en PRODUCCIÓN** (`fbxupwwgiebhlciqftpw`, `BASELINE_REMOTO.md:13-25`).
> No se ejecuta ningún paso sin **aprobación humana explícita y previa**. Está deliberadamente
> separada de quien diseñó las migraciones.
>
> Alcance: **solo DDL aditivo**. Gracias a la línea base perezosa (`DECISIONES.md` D0), esta tarea
> **no escribe ni una fila de negocio**. La diferencia práctica: revertirla es un `drop column`, no
> deshacer miles de filas de historia inventada.

**1. Propietario**: CLAUDE.

**2. Objetivo y resultado observable**
Aplicar al remoto `20260716100000_baseline_provenance_and_helper.sql` y
`20260716110000_baseline_mount_rpc_and_gate.sql`. Resultado observable:
`supabase_migrations.schema_migrations` incluye ambas versiones; `v_unit_position_state` marca
2 092 posiciones como `baseline_pending`; las 4 suites SQL vigentes pasan **sin editarse**; y los
conteos de negocio siguen en **36 / 37 / 37**.

**3. Dependencias y tareas que bloquea**
Depende de: `task_05` **APROBADO** y aprobación humana. Bloquea: `task_07`, `task_10`.
Estado inicial: **BLOQUEADA POR DECISIÓN HUMANA**.

**4. Archivos**
- Permitidos: **ninguno del repo**. Esta tarea no edita código: aplica lo que `task_03`/`task_04`
  escribieron y `task_05` probó.
- Prohibidos: modificar las migraciones. Si algo está mal, **se detiene** y vuelve a
  `task_03`/`task_04` en `EN CORRECCIÓN`. Aplicar una migración editada sobre la marcha rompe la
  separación diseño/aplicación y anula la revisión.

**5. Contratos**
Los de `PLAN.md §2.1`, `§3`, `§4` y `§5`, tal como quedaron aprobados. Ninguno nuevo.

**6. Pasos**
1. **Comprobar la aprobación humana por escrito** y que `task_05` cerró con `TESTS_PASSED`, y que
   `sync-migration-reviewer` no dejó hallazgos abiertos en ninguna de las dos migraciones.
2. **Foto previa**: correr `supabase/diagnostics/baseline_profile.sql` (Q1–Q5) y guardar la salida.
3. Verificar que no hay colisión:
   `select to_regtype('public.record_origin'), to_regproc('public.fn_create_casing_cycle_installation'),
   to_regproc('public.confirm_baseline_mount'), to_regclass('public.baseline_mount_batches');`
   → los cuatro `null`. Si alguno existe, **detenerse**.
4. Verificar que el timestamp sigue siendo mayor a la última versión remota (hoy `20260714042911`,
   `AUDIT.md §4.1`). Si entró una migración nueva, recalcular antes de aplicar.
5. Aplicar `20260716100000` (MCP `apply_migration`). Verificar de inmediato:
   - `select origin, count(*) from public.tire_installations group by 1;` → `workshop`=37, nada más.
   - `select count(*) from pg_proc where proname='register_full_installation';` → **1** (no se creó
     una sobrecarga).
   - `select count(*) filter (where baseline_pending) from public.v_unit_position_state;` → 2 092.
   - `v_unit_position_state` conserva sus 28 columnas originales (`data.js:1-30` las pide por
     nombre) + las 9 nuevas.
   - `v_inventory_status` y las vistas `v_casing_*` (sin DDL versionado, `AUDIT.md` B9) siguen
     resolviendo: `select 1 from <cada una> limit 1`.
   - `fn_create_casing_cycle_installation` **no** ejecutable por `anon`/`authenticated`
     (`pg_proc.proacl`).
6. **Correr las 4 suites vigentes sin editarlas** → `TESTS_PASSED` ×4. En particular
   `workshop_rpcs.test.sql`: es el juez de que la extracción del helper no cambió
   `register_full_installation`. Si falla, **rollback inmediato** con
   `down/20260716100000_down.sql` y `EN CORRECCIÓN`.
7. Aplicar `20260716110000`. Verificar de inmediato:
   - `select count(*) from pg_proc where proname='confirm_tire_change_batch';` → **1**.
   - `confirm_baseline_mount`: `revoke` a `anon`, `execute` a `authenticated`.
   - `baseline_mount_batches`: RLS activa, policy `select_own_company`, `anon` sin privilegios.
8. **Correr las 4 suites otra vez** → `TESTS_PASSED` ×4. `tire_change_batch.test.sql` es el juez de
   que el gate no degradó el lote.
9. Correr `baseline_mount.test.sql` (`task_05`) contra el remoto ya migrado → `TESTS_PASSED`,
   auto-reversible.
10. **Foto posterior**: `baseline_profile.sql` otra vez. Los conteos de negocio deben ser
    **idénticos** a la foto previa: las migraciones son puro DDL aditivo.
11. `get_advisors` (security y performance).

**7. Invariantes**
- **Nada destructivo, nada difícil de revertir sin aprobación explícita** (`CLAUDE.md`).
- Las migraciones se aplican **tal cual fueron revisadas**. Cero edición en caliente.
- **Cero filas de negocio creadas o modificadas** por esta tarea. Probarlo con las fotos, no
  asumirlo.
- Los contratos vigentes no se degradan: `register_full_installation`, `register_removal`,
  `transfer_tire`, `confirm_tire_change_batch`, `v_unit_position_state` y
  `v_tire_inventory_available` siguen funcionando igual. Los tests sin editar son la prueba.
- RLS por empresa y grants mínimos verificados **en el remoto**, no solo en el archivo.
- `service_role`, claves y credenciales **nunca** aparecen en el repo, en `STATE.md` ni en el
  handoff.

**8. Casos de error, ambigüedad y concurrencia**
| Caso | Acción |
|---|---|
| `apply_migration` falla a mitad | Postgres revierte (DDL transaccional). Reportar el error crudo, **no** reintentar a ciegas, volver a diseño `EN CORRECCIÓN`. |
| La migración 1 aplica y la 2 falla | Ejecutar `down/20260716100000_down.sql` (probado en `task_03`) y volver a diseño. |
| Una suite vigente falla tras aplicar | **Rollback inmediato de ambas** y `EN CORRECCIÓN`. Es una regresión, no un detalle. |
| `baseline_pending` muy distinto de 2 092 | No bloquea (pueden haber entrado inspecciones), pero **debe explicarse** antes de cerrar. |
| Alguien aplica otra migración en paralelo | Verificar el timestamp máximo remoto **inmediatamente antes** de aplicar. |
| Taller opera durante la aplicación | El DDL aditivo no interfiere; el `alter table add column` con default constante toma un lock brevísimo sobre 37 filas. |

**9. Criterios de aceptación**
- Las dos versiones figuran en `supabase_migrations.schema_migrations`.
- 37 instalaciones `origin='workshop'`, 0 con otro valor.
- Cascos/ciclos/instalaciones: **36 / 37 / 37**, idénticos a la foto previa y a `AUDIT.md §4.1`.
- `pg_proc`: **una sola** `register_full_installation` y **una sola** `confirm_tire_change_batch`.
- `baseline_pending` ≈ 2 092 (o el delta explicado).
- `fn_create_casing_cycle_installation` no ejecutable por `anon`/`authenticated`;
  `confirm_baseline_mount` sí por `authenticated`, no por `anon`.
- Las 4 suites vigentes → `TESTS_PASSED`, **sin editarlas**. `baseline_mount.test.sql` →
  `TESTS_PASSED`.
- `get_advisors security`: sin lints nuevos salvo el WARN esperado de `security definer`
  (`BASELINE_REMOTO.md:171-174`); **ningún** "RLS disabled" ni "policy exists RLS disabled".

**10. Comandos y verificación**
MCP Supabase: `apply_migration` (×2), `execute_sql` (verificaciones, suites, fotos),
`get_advisors`, `list_migrations`.

**11. Rollback / limpieza**
Plan probado en efímero **antes** de aplicar (`task_03` paso 8, `task_04` paso 6):
1. `down/20260716110000_down.sql` — dropea `confirm_baseline_mount` y `baseline_mount_batches`, y
   **restaura `confirm_tire_change_batch` a `20260714120000:33-609` literal**.
2. `down/20260716100000_down.sql` — dropea el helper, las columnas y el enum, y **restaura
   `register_full_installation` y `v_unit_position_state` a su definición vigente literal**.
Como no se escribió ni una fila de negocio, **no hay datos que revertir**: el rollback es puramente
estructural y no pierde nada. Verificar después con las 4 suites → `TESTS_PASSED`.

**12. Handoff a `STATE.md`**
Fila `task_06` → `Resultado`: versiones aplicadas, conteos verificados, **cuántas posiciones quedan
`baseline_pending` por empresa** (es lo que `task_07` va a proyectar y lo que mide el avance de la
puesta en marcha), y confirmación de que los conteos de negocio no se movieron. `Revisión`: salidas
de `apply_migration`, `TESTS_PASSED` ×5 (4 vigentes sin editar + la nueva), `get_advisors`, y las
fotos antes/después del `baseline_profile.sql`.
