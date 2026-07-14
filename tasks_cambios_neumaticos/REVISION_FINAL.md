# REVISION_FINAL — Revisión cruzada de integración (task_07)

Fecha: 2026-07-13. Revisor: CLAUDE. Alcance: **100 % lectura** (SELECT / catálogo / advisors) +
re-ejecución de los tres archivos de `supabase/tests/`. No se aplicó DDL/DML persistente: cada test
se auto-revierte con `raise exception 'TESTS_PASSED'`. No se corrigió código: las verificaciones se
re-ejecutaron de forma independiente (no se confió en los handoffs).

Proyecto remoto verificado: **`fbxupwwgiebhlciqftpw`** (el productivo, confirmado en BASELINE §0;
el homónimo `zkifhlayacqexksrfdxc` está vacío y no se usa).

---

## Veredicto global

**APTO PARA FASE 2.** Los 10 ítems del checklist pasan. Dos observaciones **menores no
bloqueantes** (§ítems 6 y 7) y las derivas informativas de AUDIT quedan escaladas al humano
(§ítem 10). Ninguna requiere corregir código ni marca tareas EN CORRECCIÓN ⚠.

El smoke test en navegador **no** forma parte de esta revisión: pertenece a la Fase 2 (frontend
futuro). Queda anotado como pendiente en §Pendientes de Fase 2.

---

## Checklist con evidencia

### 1. Contratos respetados — ✓

`information_schema.columns` (remoto):

- `v_unit_position_state`: **28 columnas** en el orden exacto de PLAN 2.1 / CONTRATOS_UI §2.2:
  `company_id, unit_id, plate, config_id, position_number, side, axle_number, axle_type,
  is_ground, installation_id, life_cycle_id, casing_id, casing_code, brand_name, model_name,
  size_name, condition, retread_design, cycle_number, installed_at, odometer_at_install,
  rtd_at_install_mm, is_empty, last_inspected_on, last_rtd_movi_mm, last_pressure_psi,
  last_inspection_tire_code, code_mismatch`.
- `v_tire_inventory_available`: **15 columnas** en el orden exacto de PLAN 2.2 / CONTRATOS_UI §4.2:
  `company_id, life_cycle_id, casing_id, casing_code, brand_name, model_name, size_name,
  condition, cycle_number, retread_design, otd_mm, last_removed_at, last_removal_reason,
  last_rtd_mm, days_in_inventory`.
- Firma RPC (`pg_get_function_arguments`/`pg_get_function_result`):
  `confirm_tire_change_batch(p_batch jsonb) returns jsonb` — idéntica a PLAN 2.5.

### 2. RLS y permisos — ✓

Evidencia de catálogo (`pg_class`, `pg_policy`, `information_schema.role_table_grants`,
`has_function_privilege`, `pg_proc.proconfig`):

| Objeto | Verificado |
|---|---|
| `tire_change_batches` | `relrowsecurity=true`; policy `select_own_company` cmd=`r` (SELECT) rol `authenticated`; grants = **solo** `authenticated SELECT` (sin escritura de cliente, sin `anon`) |
| `v_unit_position_state` | `reloptions = security_invoker=true`; grants = **solo** `authenticated SELECT` (sin `anon`) |
| `v_tire_inventory_available` | `reloptions = security_invoker=true`; grants = **solo** `authenticated SELECT` (sin `anon`) |
| `fn_mount_existing_cycle` | `has_function_privilege('authenticated', …, 'execute') = false` (helper interno no expuesto) |
| `confirm_tire_change_batch` | `prosecdef=true`; `proconfig={search_path=public}`; EXECUTE `authenticated=true`, `anon=false` |

No repite la deriva D-C: las vistas nuevas se crearon con `revoke all` + `grant select to
authenticated`, a diferencia del `GRANT ALL` heredado de las vistas `v_casing_*`.

### 3. Atomicidad e idempotencia — ✓

`supabase/tests/tire_change_batch.test.sql` re-ejecutado por el revisor vía MCP →
`ERROR P0001: TESTS_PASSED` (casos B1–B9: lote mixto retén+mount+swap, bloqueo optimista obsoleto
sin efectos, reintento idempotente sin duplicar historia, validaciones de lote inválido, ciclo
descartado no montable, posición ocupada, aislamiento cross-tenant, rol inspector, swap con un
lado desactualizado). La carrera de dos sesiones queda evidenciada en el handoff de task_05
(`CONCURRENCY_SESSION_2_PASSED_ESTADO_DESACTUALIZADO`, residuo de limpieza = 0); el guion
reproducible vive comentado al pie del mismo archivo de test.

### 4. Lecturas — ✓

- `supabase/tests/unit_state_reads.test.sql` re-ejecutado → `ERROR P0001: TESTS_PASSED`
  (T1 conteo de posiciones, T2 instalación visible, T3 retén libera+aparece en inventario,
  T4 descarte no disponible, T5 aislamiento RLS entre empresas, T6 medición legada en posición
  vacía, grants).
- `supabase/tests/workshop_rpcs.test.sql` (previo) re-ejecutado → `ERROR P0001: TESTS_PASSED`
  (T1–T9). **No se rompió nada existente.**

### 5. Historial e invariantes — ✓

- Las tres migraciones nuevas solo hacen `CREATE VIEW`/`CREATE TABLE`/`CREATE FUNCTION`/
  `CREATE INDEX` y la RPC solo `INSERT` en `tire_change_batches`; **ningún UPDATE/DELETE de
  historia** (revisado línea por línea). Los retiros/instalaciones se agregan componiendo
  `register_removal` y `fn_mount_existing_cycle`; nunca se pisa una instalación cerrada.
- Índices-candado presentes en remoto: `tire_installations_active_pos_uidx`,
  `tire_installations_active_cycle_uidx`, `tire_life_cycles_active_uidx`.
- Sin hardcodeo: las vistas derivan de tablas/catálogos; la RPC toma las causas de descarte de
  `enum_range(null::public.discard_cause)` y las posiciones de `tire_positions`; no fija umbrales.

### 6. Orden de migraciones — ✓ (con observación menor)

- Nombres locales en orden 02 → 03 → 04: `20260714100000` < `20260714110000` < `20260714120000`,
  todos posteriores a la última existente al planificar (`20260712010000`) y a la última remota
  (`20260713001125`).
- `list_migrations` remoto: `tire_change_batches_and_mount_helper` (`20260714012206`),
  `unit_position_state_and_inventory_views` (`20260714012209`),
  `confirm_tire_change_batch_rpc` (`20260714015430`).
- **Observación menor (no bloqueante)**: en el remoto, la migración de task_03 (batches+helper)
  quedó aplicada ~3 s **antes** que la de task_02 (vistas). Es inocuo: ambas son independientes
  (las vistas no referencian la tabla de lotes ni viceversa) y la única dependencia real —la RPC
  de task_04 sobre `fn_mount_existing_cycle` de task_03— se respeta (015430 > 012206). El orden
  canónico por nombre de archivo local es correcto.
- Advisors de seguridad (`get_advisors security`): solo WARN, ninguno nuevo atribuible a estos
  objetos salvo el **esperado** `authenticated_security_definer_function_executable` sobre
  `confirm_tire_change_batch` (mismo patrón que el resto de RPCs de taller; anticipado en
  BASELINE §4.1). `fn_mount_existing_cycle` **no** aparece (correcto: no expuesto). Sin lints de
  "RLS disabled"/"policy exists RLS disabled" sobre las tablas/vistas nuevas. El resto (btree_gist
  en public, leaked password protection, RPCs móviles `anon`) es preexistente y ajeno al PLAN.

### 7. `STATE.md` consistente — ✓ (con observación menor)

Las 7 filas tienen estado, resultado con evidencia y revisión; sin tareas colgadas.
**Observación menor (cosmética)**: la fila de task_05 usa `APROBADO` sin el `✓` que usan las
demás. No afecta la trazabilidad; se puede unificar al cerrar.

### 8. Contratos frontend documentados — ✓

`CONTRATOS_UI.md` está completo y es autocontenido: columnas exactas de ambas vistas, firma y ACL
de la RPC, payload v1 completo, respuestas reales (éxito y reintento idempotente), los cinco
errores con `error.code`/prefijo, recetas `RenovaSupabase`, precisiones de implementación (§9) y
pendientes de Fase 2 (§11). Coherente con lo aplicado y verificado (28/15 columnas, secdef,
search_path, grants).

### 9. Exclusiones respetadas — ✓

`git status` confirma que los únicos archivos versionados nuevos son las 3 migraciones, los 2
tests y los documentos de `tasks_cambios_neumaticos/`. **Nadie tocó `app/` ni `WEB/`** (los cambios
en `.tokensave/*` son artefactos de indexación local, ajenos al entregable).

### 10. Derivas del AUDIT — disposición registrada, sin resolver en silencio — ✓

- **AUDIT 5.2 (DDL no versionado de `v_inventory_status`/`v_casing_*`)** → registrada en BASELINE
  §1.3, §2 y §5 como deriva **D-B**; **escalada al humano** para saneamiento (versionar en el repo
  las vistas que hoy solo existen en remoto). No bloquea: las tareas 02–04 solo agregan objetos
  nuevos y la vista de inventario nueva **convive** con `v_inventory_status` (no la reemplaza ni la
  toca).
- **AUDIT 5.3 (specs sin reglas de cambios de neumáticos)** → registrada en AUDIT y en la decisión
  5 del PLAN: los contratos se diseñaron como **propuestos** apoyados en la implementación vigente
  (`20260712000000` + `knowledge/ai/07`). Disposición: **aceptada con condición** — si el negocio
  aprueba reglas distintas, hay que actualizar `specs/reglas_negocio.md` **y** el PLAN juntos. Queda
  como recomendación al humano, no resuelta en esta fase de backend.

Derivas adicionales D-A (proyecto homónimo vacío) y D-C (grants abiertos en `v_casing_*`/
`v_inventory_status`) también quedan escaladas al humano en BASELINE §5.

---

## Recomendaciones al humano / Fase 2 (no ejecutadas)

- **Puerta de entrada a Fase 2**: este `REVISION_FINAL.md` + `CONTRATOS_UI.md`.
- **Documentación**: actualizar `knowledge/ai/05` (datos/vistas) y `knowledge/ai/07` (operaciones de
  taller) según `knowledge/ai/14 - Mantenimiento documental.md` y correr `npm run docs:check`, dado
  que hay vistas de lectura y una API SQL (RPC de lote) nuevas.
- **Saneamiento remoto** (derivas D-A/D-B/D-C, AUDIT 5.2/5.3): elegir/renombrar el proyecto
  productivo, versionar en el repo las vistas remotas no versionadas, endurecer los grants de las
  vistas `v_casing_*`/`v_inventory_status`, y decidir si se aprueban formalmente las reglas de
  cambios en `specs/`.
- **Redacción menor** (BASELINE §3.3): corregir el paréntesis de PLAN 2.4 —`fn_validate_free_position`
  tampoco está expuesto a `authenticated`—; es solo texto del plan, sin impacto en el código.
- **Cosmético**: unificar el `✓` en la fila task_05 de `STATE.md`.

## Pendiente de Fase 2 (fuera de alcance de esta revisión)

Smoke test real en navegador (sesión, lecturas, lote mixto, reintento, conflicto
`[estado_desactualizado]`, consola limpia y recarga persistente), captura/upload real de la foto de
descarte a Storage, render de posiciones vacías y estados provisionales, y pruebas de UI. Detalle
en `CONTRATOS_UI.md` §11.
