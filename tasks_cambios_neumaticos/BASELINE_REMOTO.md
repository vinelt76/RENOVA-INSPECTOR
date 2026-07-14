# BASELINE_REMOTO — Verificación remota (task_01)

Fecha: 2026-07-13. Ejecutor: CLAUDE. Alcance: **100 % lectura** del proyecto Supabase remoto
(SELECT / catálogo / advisors). No se aplicó DDL/DML ni migraciones. La única operación con
efectos fue correr el test existente `workshop_rpcs.test.sql`, que **se auto-revierte** con
`raise exception 'TESTS_PASSED'` (ningún dato queda persistido — es su diseño).

Acceso: MCP Supabase (solo lectura). Fuente de cada afirmación = query de catálogo + resultado
resumido.

---

## 0. Proyecto remoto real (deriva nueva **D-A**)

| Proyecto | project_ref | Migraciones | ¿Es el productivo? |
|---|---|---|---|
| "a20233413-wq's Project" | `fbxupwwgiebhlciqftpw` | **37 aplicadas** | **SÍ** |
| "RENOVA-INSPECTOR" | `zkifhlayacqexksrfdxc` | **0 (vacío)** | No |

- Evidencia: `list_projects` + `list_migrations` en ambos; el segundo devuelve `{"migrations":[]}`.
- Confirmación cruzada con el repo: `WEB/supabase-config.public.js:9` →
  `url: "https://fbxupwwgiebhlciqftpw.supabase.co"`.
- **Conclusión**: el ID histórico de knowledge (`fbxupwwgiebhlciqftpw`) es el correcto pese al
  nombre confuso. El proyecto *llamado* "RENOVA-INSPECTOR" está vacío y NO debe usarse. Todas las
  verificaciones siguientes son sobre `fbxupwwgiebhlciqftpw`.

---

## 1. Inventario remoto vs migraciones locales

### 1.1 Tablas base (`public`) — 18

`anomaly_catalog, axles, companies, company_settings, inspection_measurements, inspections,
profiles, route_types, routes, rtd_thresholds, tire_casings, tire_installations,
tire_life_cycles, tire_positions, tire_removals, unit_route_assignments, units, vehicle_configs`.

Todas coinciden con las migraciones locales. **Ninguna de las tablas del PLAN existe todavía**:
`tire_change_batches` NO está presente → sin colisión (contrato 2.3 libre).

### 1.2 Enums — coinciden con la migración base

`removal_reason = {retread, rotation, retention, discard, other}` ·
`discard_cause = {Servicio, Neumático, Conducción-Ruta, Mantenimiento Alineación, Proveedor, Otro}` ·
`tire_condition = {N,R1,R2,R3,R4}` · `odometer_source = {manual, last_inspection, unknown}` ·
`life_cycle_status = {active, retreaded, discarded}` · `casing_status = {active, discarded}`.

→ El PLAN (decisión 5) **no necesita ampliar enums**: retén=`retention`, swap=`rotation`,
descarte=`discard` ya existen. ✓

### 1.3 Vistas remotas (18) — hay 7 más que las versionadas localmente

Versionadas y presentes: `v_fleet_unit_status, v_fleet_status_summary, v_unit_tire_status,
v_inspection_dashboard_rows, v_rendimiento_dashboard_rows, v_unit_current_route,
v_installation_route_attribution`.

**Sin DDL en `supabase/migrations/` (solo existen en remoto)** — confirma deriva AUDIT 5.2:
`v_inventory_status, v_casing_history_summary, v_casing_installations, v_casing_inspections,
v_casing_lifetime_performance, v_installation_km, v_axle_performance, v_tire_performance,
v_life_cycle_performance, v_installation_activity, v_code_quality`.

→ Las vistas del PLAN (`v_unit_position_state`, `v_tire_inventory_available`) **NO existen** →
sin colisión (contratos 2.1 y 2.2 libres).

### 1.4 Funciones del PLAN — ninguna existe

`fn_mount_existing_cycle` y `confirm_tire_change_batch` **NO están** en `pg_proc` → sin colisión
(contratos 2.4 y 2.5 libres). Sí existen los helpers a reutilizar: `fn_require_workshop_profile`,
`fn_validate_free_position`, `register_removal`, `register_full_installation`, `transfer_tire`,
`current_company_id` (todas `security definer`).

### 1.5 Divergencia de historial de migraciones (deriva nueva **D-B**)

El remoto tiene migraciones **sin archivo local equivalente** y con nombres/timestamps distintos,
p. ej.: `run3_*` (code_status, functions/views from html, security_hardening),
`add_delete_inspections_by_date_helper`, `restrict_current_company_id_rpc_exposure`,
`add_cruz_ittsa_civa_companies/profiles/rtd`, `performance_comparison_view`,
`restrict_workshop_helper_functions`, `remove_inventario_comparativo_backend`. Los timestamps
locales (`20260706120000…`) no coinciden con los remotos (`20260707043151…`).
**Impacto**: entorno no reproducible 1:1 desde el repo (riesgo ya anticipado en AUDIT 5.2/5.6).
No bloquea el PLAN: las tareas 02-04 solo agregan objetos nuevos. La última migración remota es
`20260713001125`; los timestamps del PLAN (`20260714…`) quedan por encima. ✓

---

## 2. DDL real de las vistas no versionadas (deriva AUDIT 5.2)

Las 4 auditadas tienen `reloptions = {security_invoker=on}` (evidencia: `pg_class.reloptions` +
`pg_get_viewdef`).

- **`v_inventory_status`**: una fila por casco. Deriva ciclo actual (mayor `cycle_number`),
  instalación activa (`ai`), y último retiro (`lr`). Expone `inventory_status ∈
  {discarded, installed, in_inventory}`. Es **más amplia** que el "retén disponible" del PLAN 2.2
  (incluye instalados y descartados). La usan `historial-neumatico.html` y el test
  (`workshop_rpcs.test.sql:130,144`).
- **`v_casing_inspections`**: mediciones de inspección atribuidas a cada casco por ventana
  instalación↔retiro.
- **`v_casing_installations`**: instalaciones (activas y cerradas) por casco, con km (vía
  `v_installation_km`).
- **`v_casing_history_summary`**: resumen sobre `v_inventory_status` + `v_casing_lifetime_performance`
  + última inspección de `v_casing_inspections`.

(DDL completo capturado en la sesión; se conserva la definición literal de `v_inventory_status`
como la más relevante para el PLAN.)

**Recomendación contrato 2.2** → ver §5.

---

## 3. RLS y grants REALES

### 3.1 RLS de tablas base (evidencia `pg_class.relrowsecurity` + `pg_policy`)

| Tabla | RLS | Policy (SELECT) | USING |
|---|---|---|---|
| `tire_casings` | ✓ on | `select_own_company` (authenticated) | `company_id = (select current_company_id())` |
| `tire_life_cycles` | ✓ on | `select_own_company` (authenticated) | ídem |
| `tire_installations` | ✓ on | `select_own_company` (authenticated) | ídem |
| `tire_removals` | ✓ on | `select_own_company` (authenticated) | ídem |
| `units` | ✓ on | `select_own_company` (authenticated) | ídem |
| `profiles` | ✓ on | `select_own_company` (authenticated) | ídem |
| `tire_positions` | ✓ on | `select_authenticated` (authenticated) | `true` (catálogo PATRON) |

→ El patrón `select_own_company` que la tabla nueva `tire_change_batches` debe replicar (PLAN 2.3)
existe tal cual. ✓  Las vistas `security_invoker` heredan estas policies por empresa. ✓

### 3.2 Grants de tablas (`role_table_grants`)

- Tablas base (`tire_casings, tire_life_cycles, tire_installations, tire_removals, units,
  tire_positions, profiles`): `anon` y `authenticated` = **solo SELECT**; escritura solo
  `postgres`/`service_role`. → Confirma AUDIT 4.2: toda escritura pasa por RPCs `security definer`. ✓

- **Vistas no versionadas** (`v_inventory_status, v_casing_history_summary, v_casing_installations,
  v_casing_inspections`): tienen **`GRANT ALL` a `anon` Y `authenticated`** (SELECT + INSERT +
  UPDATE + DELETE + …). → **Deriva nueva D-C**: no fueron endurecidas. Impacto real bajo
  (`security_invoker=on` + RLS solo-authenticated ⇒ `anon` no ve filas; los INSERT/UPDATE/DELETE
  fallan porque el rol carece de permiso en las tablas base), pero contradice el patrón deseado
  "vistas nuevas: solo SELECT a authenticated, nunca anon" (AUDIT 7). **Las vistas del PLAN deben
  crearse bien**: `revoke all` + `grant select to authenticated` (no anon).

### 3.3 EXECUTE reales de funciones (`pg_proc.proacl`)

| Función | authenticated | Notas |
|---|---|---|
| `register_removal` | ✓ EXECUTE | se compone dentro del lote (PLAN) |
| `transfer_tire` | ✓ EXECUTE | no se reutiliza en el lote |
| `register_full_installation` | ✓ EXECUTE | no se reutiliza (crea casco nuevo) |
| `current_company_id` | ✓ EXECUTE | usado por RLS |
| `fn_require_workshop_profile` | ✗ (solo postgres/service_role) | helper interno |
| `fn_validate_free_position` | ✗ (solo postgres/service_role) | helper interno |

→ `fn_require_workshop_profile` y `fn_validate_free_position` **NO están expuestos a
authenticated** (migración remota `restrict_workshop_helper_functions`). Coincide con que
`fn_mount_existing_cycle` (PLAN 2.4) sea interno (`revoke all … from public, anon, authenticated`).
**Nota menor**: el paréntesis del PLAN 2.4 ("a diferencia de `fn_validate_free_position`, no se
expone") es impreciso — `fn_validate_free_position` **tampoco** está expuesto. No bloquea nada;
conviene corregir la redacción del PLAN al implementar task_03.

---

## 4. Advisors del proyecto

### 4.1 Seguridad (`get_advisors security`) — todos WARN, ninguno bloqueante y ninguno nuevo

- `security_definer` ejecutables por `anon`: `save_inspection`, `get_umbrales_rtd`,
  `get_unidad_preload` (esperado: flujo móvil `anon`).
- `security_definer` ejecutables por `authenticated`: `assign_unit_route`, `current_company_id`,
  `register_full_installation`, `register_removal`, `transfer_tire`, `save_inspection`,
  `get_umbrales_rtd`, `get_unidad_preload` (esperado: RPCs de taller/dashboard).
- `extension_in_public` (`btree_gist`) y `auth_leaked_password_protection`: preexistentes, ajenos
  al PLAN.
- **Implicación para PLAN 2.5**: `confirm_tire_change_batch` (security definer, grant a
  authenticated) generará un WARN `authenticated_security_definer_function_executable` **esperado y
  aceptable** — es exactamente el patrón de los RPCs de taller vigentes. No hay lints de
  "RLS disabled" ni "policy exists RLS disabled" sobre las tablas del PLAN.

### 4.2 Performance (`get_advisors performance`) — solo INFO

Múltiples `unindexed_foreign_keys` (nivel INFO) en tablas del dominio (`tire_installations`,
`tire_life_cycles`, `tire_removals`, `profiles`, `units`, etc.). Preexistente, informativo. Para
`tire_change_batches` (PLAN 2.3) conviene el índice `(unit_id, applied_at desc)` que el propio PLAN
ya prevé, más cubrir sus FKs si se quiere evitar sumar a esta lista.

---

## 5. Veredicto por contrato del PLAN (2.1–2.5)

| Contrato | Veredicto | Evidencia / condición |
|---|---|---|
| **2.1 `v_unit_position_state`** | **COMPATIBLE** | Nombre libre. Fuentes verificadas: `units(id, plate, config_id, company_id)`, `tire_positions(position_number, side, is_ground, axle_id)`, `axles(axle_number, axle_type)`, `tire_installations(installation_id, life_cycle_id, installed_at, odometer_at_install, rtd_at_install_mm, removed)`, `tire_life_cycles(condition, cycle_number, retread_design, casing_id)`, `tire_casings(code, brand_name, model_name, size_name)`, `inspection_measurements(tire_code, rtd_movi_mm, pressure_psi, position_number, inspection_id)` + `inspections(unit_id, inspected_on)`. `code_mismatch` = `casing.code` vs `im.tire_code` (ambos existen). Crear con `security_invoker=true` + solo SELECT a authenticated. |
| **2.2 `v_tire_inventory_available`** | **COMPATIBLE — CONVIVE, no reemplaza** | `v_inventory_status` es más amplia (todos los cascos, incl. instalados/descartados) y la consumen `historial-neumatico.html` y el test (líneas 130/144). La vista nueva es un subconjunto ("retén disponible" = ciclos `active` de cascos `active` sin instalación activa). **No tocar `v_inventory_status`.** Nombre nuevo libre. `security_invoker=true` + solo SELECT a authenticated. |
| **2.3 `tire_change_batches`** | **COMPATIBLE** | Tabla no existe. FK a `companies(id)`, `units(id)`, `profiles(id)` — los tres `uuid NOT NULL` PK existen. Patrón RLS `select_own_company` disponible para replicar. Índices-candado heredados existen (§6). |
| **2.4 `fn_mount_existing_cycle`** | **COMPATIBLE** | No existe. `fn_validate_free_position` disponible (interno). Hacerlo interno (`revoke all`) es consistente con los helpers actuales. Corregir redacción del PLAN (§3.3, nota menor). |
| **2.5 `confirm_tire_change_batch`** | **COMPATIBLE** | No existe. `fn_require_workshop_profile` (rol/empresa) y `register_removal` (firma exacta `p_life_cycle_id, p_removed_at, p_reason, p_odometer, p_rtd_mm, p_discard_cause, p_photo_url, p_notes`) disponibles. Enums `removal_reason`/`discard_cause` cubren retén/swap/descarte. WARN de advisor esperado y aceptable (§4.1). |

**Ningún contrato requiere ajuste del PLAN.** Las derivas nuevas D-A/D-B/D-C son informativas y no
bloquean task_03/task_04; se recomiendan al humano para saneamiento (elegir/renombrar proyecto,
versionar vistas remotas, endurecer grants de las vistas `v_casing_*`/`v_inventory_status`).

---

## 6. Índices-candado de concurrencia (verificados)

Existen tal como el PLAN los asume (heredados "gratis" por la RPC de lote):

- `tire_installations_active_pos_uidx`  `UNIQUE (unit_id, position_number) WHERE (NOT removed)`
- `tire_installations_active_cycle_uidx` `UNIQUE (life_cycle_id) WHERE (NOT removed)`
- `tire_life_cycles_active_uidx` `UNIQUE (casing_id) WHERE (status = 'active')`
- `tire_casings_company_code_uidx` `UNIQUE (company_id, code) WHERE (code IS NOT NULL)`

---

## 7. Test existente (paso 6)

`supabase/tests/workshop_rpcs.test.sql` ejecutado vía MCP `execute_sql` contra
`fbxupwwgiebhlciqftpw`. **Resultado esperado obtenido**: `ERROR: P0001: TESTS_PASSED` en la línea
del `raise` final (todos los casos T1–T9 pasaron; la transacción del `DO` revirtió, sin datos
persistidos). ✓ No hay conflicto intención/implementación en las RPCs vigentes.

---

## 8. Resumen para task_02 y task_03

- Proyecto productivo confirmado: **`fbxupwwgiebhlciqftpw`** (no el homónimo vacío).
- Nombres de los 5 objetos del PLAN: **libres de colisión**.
- Tipos/columnas de origen: **verificados y compatibles**.
- Grants a aplicar en las vistas nuevas: **`revoke all` + `grant select to authenticated`** (no
  anon) — no repetir la deriva D-C de las vistas `v_casing_*`.
- `v_inventory_status` **no se toca** (la nueva vista de inventario convive).
- Helpers internos (`fn_require_workshop_profile`, `fn_validate_free_position`, y el futuro
  `fn_mount_existing_cycle`): sin EXECUTE a authenticated.
- Timestamps de migración: usar > `20260713001125` (última remota) — el rango `20260714…` del PLAN
  es válido.
