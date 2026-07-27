# Evidencia — consultas de solo lectura contra producción

Proyecto `fbxupwwgiebhlciqftpw`. Todas las consultas son `SELECT`; no se aplicó ninguna
migración ni escritura durante esta auditoría.

## D1 — Perfiles por rol y empresa

```sql
select p.role::text, p.active, c.name as company, count(*) as n
from public.profiles p join public.companies c on c.id = p.company_id
group by 1,2,3 order by 3,1;
```

| rol | activo | empresa | n |
|---|---|---|---|
| fleet_manager | true | CIVA | 1 |
| fleet_manager | true | CRUZ DEL SUR | 1 |
| fleet_manager | true | ITTSABUS | 1 |
| fleet_manager | true | MÓVIL BUS | 1 |
| operator | true | MÓVIL BUS | 1 |

**0 perfiles con rol `tire_supervisor`.** **0 operarios fuera de MÓVIL BUS.**

## D2 — Volumen operativo

```sql
select (select count(*) from public.tire_movement_orders) as orders, ...
```

| métrica | valor |
|---|---|
| órdenes de movimiento | 4 (0 issued, 1 in_progress, 3 completed) |
| ejecuciones capturadas | 8 |
| ejecuciones `reconciliation_status='pending'` | 8 (100 %) |
| inspecciones | 288 |
| mediciones | 2 247 |
| empresas | 4 |
| unidades | 269 |

## D3 — Órdenes existentes

| id | estado | empresa | placa | programada | ítems |
|---|---|---|---|---|---|
| b47fd97b… | completed | MÓVIL BUS | 2145 | 2026-07-22 | 2 |
| cd5c27db… | completed | MÓVIL BUS | 2145 | 2026-07-22 | 4 |
| 71f7aaba… | completed | MÓVIL BUS | QA-CN16 | 2026-07-21 | 2 |
| **63b5ccf7-a095-443d-b056-82601ff3e456** | **in_progress** | MÓVIL BUS | **QA-CN16** | 2026-07-19 | 1 |

La última quedó tomada y sin cerrar desde el 2026-07-20 sobre la unidad de prueba.

## D4 — RLS efectiva contra `anon` (control positivo)

```sql
set local role anon;
select (select count(*) from public.v_inspection_dashboard_rows)  as insp,
       (select count(*) from public.v_rendimiento_dashboard_rows) as rend,
       (select count(*) from public.v_inventory_status)           as inv,
       (select count(*) from public.v_fleet_unit_status)          as fleet;
```

Resultado: `0, 0, 0, 0`. **RLS por empresa se sostiene en las vistas de dashboard.**

## D5 — Vistas auto-actualizables (control positivo)

```sql
select table_name, is_updatable, is_insertable_into from information_schema.views
where table_schema='public' and (is_updatable='YES' or is_insertable_into='YES');
```

Resultado: **0 filas.** Ninguna vista de `public` es auto-actualizable, por lo que los
grants amplios de DML descritos en H-06 son inertes hoy.

## D6 — Grants de DML sobre vistas

```sql
select table_name, grantee, string_agg(privilege_type, ',' order by privilege_type)
from information_schema.role_table_grants
where table_schema='public' and grantee in ('anon','authenticated') and table_name like 'v\_%'
group by 1,2;
```

**19 vistas** con `DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE` para `anon`
**y** `authenticated`:

`v_axle_performance`, `v_casing_history_summary`, `v_casing_inspections`,
`v_casing_installations`, `v_casing_lifetime_performance`, `v_code_quality`,
`v_fleet_status_summary`, `v_fleet_unit_status`, `v_inspection_dashboard_rows`,
`v_inspection_latest_facets`, `v_installation_activity`, `v_installation_km`,
`v_installation_route_attribution`, `v_inventory_status`, `v_life_cycle_performance`,
`v_rendimiento_dashboard_rows`, `v_tire_performance`, `v_unit_current_route`,
`v_unit_tire_status`.

Correctas (solo `SELECT` a `authenticated`): `v_operator_movement_orders`,
`v_search_index`, `v_tire_inventory_available`, `v_tire_services`,
`v_unit_position_state`.

## D7 — Funciones ejecutables por `anon` (excluyendo btree_gist/extensiones)

```sql
select p.proname, has_function_privilege('anon', p.oid, 'execute'), p.prosecdef
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public' and has_function_privilege('anon', p.oid, 'execute');
```

Del proyecto (no de extensiones), `anon` puede ejecutar:

| función | SECURITY DEFINER |
|---|---|
| `save_inspection(jsonb)` | **sí** |
| `get_unidad_preload(text, text)` | **sí** |
| `get_umbrales_rtd(text)` | **sí** |
| `fn_rtd_state`, `fn_channel_rtd_state`, `fn_effective_rtd_thresholds`, `fn_pressure_state_fixed`, `fn_anomaly_is_severe` | no (puras) |

## D8 — Lectura real sin sesión (evidencia de H-01)

```sql
set local role anon;
select count(*) from public.get_unidad_preload('MÓVIL BUS', '2145');   -- → 14
select count(*) from public.get_umbrales_rtd('CIVA');                   -- → 1
```

**14 filas de neumáticos de la unidad 2145 de MÓVIL BUS devueltas sin ninguna sesión**, y los
umbrales de CIVA leídos igual. Por ser `SECURITY DEFINER`, estas RPC no pasan por RLS.
La clave usada es la publicable que vive en `WEB/supabase-config.public.js` (commiteada) y
se copia al bundle estático publicado.
