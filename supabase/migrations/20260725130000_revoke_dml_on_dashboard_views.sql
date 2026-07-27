-- RENOVA — Revocar el DML concedido sobre las vistas de dashboard.
--
-- QUÉ SE ENCONTRÓ
--
-- 19 vistas de `public` tenían INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES y TRIGGER concedidos
-- a `anon` **y** `authenticated`, cuando solo necesitan SELECT. El patrón es inequívoco: un
-- `GRANT ALL ON ALL TABLES IN SCHEMA public` histórico que alcanzó a todo lo que existía en ese
-- momento. Las vistas creadas después están bien (`v_search_index`, `v_tire_services`,
-- `v_unit_position_state`, `v_tire_inventory_available`, `v_operator_movement_orders`: solo
-- SELECT a `authenticated`), lo que confirma el origen.
--
-- SEVERIDAD REAL: BAJA, PERO NO CERO
--
-- Verificado el 2026-07-25 contra producción: **ninguna vista de `public` es auto-actualizable**
-- (`information_schema.views` devuelve 0 filas con `is_updatable='YES'`), así que hoy ningún
-- INSERT o DELETE prospera. El riesgo es futuro: el día que alguien simplifique una de estas
-- vistas y pase a ser auto-actualizable, el permiso ya está puesto y nadie lo va a recordar.
--
-- SOBRE `anon`
--
-- Se le revoca también el SELECT. Hoy `anon` lee 0 filas de estas vistas porque todas tienen
-- `security_invoker = true` y la RLS de las tablas base lo bloquea — se comprobó en vivo. Pero
-- conservar un permiso "porque no molesta" es exactamente lo que produjo este hallazgo. Los
-- dashboards de `WEB/` exigen sesión antes de cualquier fetch, así que ninguno depende de `anon`.
--
-- ⚠️ VERIFICACIÓN OBLIGATORIA DESPUÉS DE APLICAR: abrir los 4 dashboards autenticados y
-- confirmar que siguen mostrando datos. Un REVOKE de más deja una pantalla en blanco, y eso no
-- lo detecta ninguna suite.

do $$
declare
  v_view text;
  v_views constant text[] := array[
    'v_axle_performance',
    'v_casing_history_summary',
    'v_casing_inspections',
    'v_casing_installations',
    'v_casing_lifetime_performance',
    'v_code_quality',
    'v_fleet_status_summary',
    'v_fleet_unit_status',
    'v_inspection_dashboard_rows',
    'v_inspection_latest_facets',
    'v_installation_activity',
    'v_installation_km',
    'v_installation_route_attribution',
    'v_inventory_status',
    'v_life_cycle_performance',
    'v_rendimiento_dashboard_rows',
    'v_tire_performance',
    'v_unit_current_route',
    'v_unit_tire_status'
  ];
begin
  foreach v_view in array v_views loop
    -- `to_regclass` evita que la migración explote si una vista se retiró: este esquema ya
    -- vio retiros deliberados (v_comparison_cycle_rows, v_removal_cause_ranking en 175e9ed).
    if to_regclass('public.' || v_view) is null then
      raise notice 'Vista ausente, se omite: %', v_view;
      continue;
    end if;

    execute format('revoke all on public.%I from public, anon, authenticated', v_view);
    execute format('grant select on public.%I to authenticated', v_view);
    raise notice 'Permisos saneados: %', v_view;
  end loop;
end;
$$;

-- Verificación esperada tras aplicar: 0 filas.
--
--   select table_name, grantee, privilege_type
--     from information_schema.role_table_grants
--    where table_schema = 'public'
--      and table_name like 'v\_%'
--      and (grantee = 'anon' or privilege_type <> 'SELECT')
--      and grantee in ('anon', 'authenticated');
