-- Agrega has_anomaly a v_rendimiento_dashboard_rows (rendimiento.html), mismo
-- criterio que v_inspection_dashboard_rows (20260710150000): "Normal" en la
-- columna anomalía del Excel no es una anomalía real.
--
-- DROP + CREATE (no CREATE OR REPLACE): "p.*" expande columnas de
-- v_tire_performance y desplaza el orden, Postgres no permite insertar una
-- columna en medio del SELECT de una vista existente.

drop view if exists public.v_rendimiento_dashboard_rows;

create view public.v_rendimiento_dashboard_rows
with (security_invoker = true) as
select
  p.*,
  co.name  as company_name,
  cs.code_status,
  tp.side,
  ax.axle_number,
  ax.axle_type,
  rt.rtd_removal_mm,
  li.inspection_id  as last_inspection_id,
  li.odometer_km    as last_inspection_odometer_km,
  li.rtd_a_mm,
  li.rtd_b_mm,
  li.rtd_c_mm,
  li.rtd_d_mm,
  li.rtd_movi_mm    as last_rtd_movi_mm,
  li.rtd_state      as last_rtd_state,
  li.pressure_psi,
  li.pressure_state,
  li.valve_cap,
  li.anomaly,
  (li.anomaly is not null and lower(trim(li.anomaly)) <> 'normal') as has_anomaly,
  li.inspector_name
from public.v_tire_performance p
join public.companies co   on co.id = p.company_id
join public.tire_casings cs on cs.id = p.casing_id
join public.units u        on u.id = p.unit_id
left join public.tire_positions tp
       on tp.config_id = u.config_id and tp.position_number = p.position_number
left join public.axles ax  on ax.id = tp.axle_id
left join lateral (
  select rt1.rtd_removal_mm
  from public.rtd_thresholds rt1
  where rt1.company_id = p.company_id
    and (rt1.size_name = p.size_name or rt1.size_name is null)
  order by rt1.size_name
  limit 1
) rt on true
left join lateral (
  select m.inspection_id, i.odometer_km,
         m.rtd_a_mm, m.rtd_b_mm, m.rtd_c_mm, m.rtd_d_mm,
         m.rtd_movi_mm, m.rtd_state, m.pressure_psi, m.pressure_state,
         m.valve_cap, m.anomaly, pr.full_name as inspector_name
  from public.inspection_measurements m
  join public.inspections i on i.id = m.inspection_id
  left join public.profiles pr on pr.id = i.inspector_id
  where i.unit_id = p.unit_id and m.position_number = p.position_number
  order by i.inspected_on desc
  limit 1
) li on true;

comment on view public.v_rendimiento_dashboard_rows is
  'Fila por instalación activa con datos FUENTE (instalación + última inspección) y métricas derivadas (v_tire_performance). Consumida por rendimiento.html. has_anomaly excluye "Normal" como no-anomalía (mismo criterio que v_inspection_dashboard_rows). Posiciones 1 y 2 quedan fuera del alcance de rendimiento por diseño (el Excel real no las evalúa).';

grant select on public.v_rendimiento_dashboard_rows to anon, authenticated;
