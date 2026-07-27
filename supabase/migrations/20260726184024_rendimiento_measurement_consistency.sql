-- Expone la inspección inmediatamente anterior dentro de la ventana de la
-- instalación activa. El frontend usa esta evidencia para excluir y declarar
-- posiciones cuyo RTD creció; no infiere ni crea instalaciones.
--
-- Las tres columnas nuevas se agregan estrictamente al final: PostgreSQL no
-- permite insertar/reordenar columnas con CREATE OR REPLACE VIEW.

create or replace view public.v_rendimiento_dashboard_rows
with (security_invoker = true)
as
select
  p.installation_id,
  p.company_id,
  p.unit_id,
  p.plate,
  p.position_number,
  p.life_cycle_id,
  p.cycle_number,
  p.condition,
  p.retread_design,
  p.otd_mm,
  p.cost,
  p.currency,
  p.casing_id,
  p.casing_code,
  p.brand_name,
  p.model_name,
  p.size_name,
  p.installed_at,
  p.odometer_at_install,
  p.rtd_at_install_mm,
  p.last_inspection_on,
  p.current_rtd_mm,
  p.current_odometer_km,
  p.end_odometer_source,
  p.rtd_worn_mm,
  p.km_run,
  p.consumption_pct,
  p.km_per_mm,
  p.km_projected,
  p.cycle_km_accumulated,
  p.casing_km_accumulated,
  p.cost_per_km,
  co.name as company_name,
  cs.code_status,
  tp.side,
  ax.axle_number,
  ax.axle_type,
  rt.rtd_removal_mm,
  li.inspection_id as last_inspection_id,
  li.odometer_km as last_inspection_odometer_km,
  li.rtd_a_mm,
  li.rtd_b_mm,
  li.rtd_c_mm,
  li.rtd_d_mm,
  li.rtd_movi_mm as last_rtd_movi_mm,
  li.rtd_state as last_rtd_state,
  li.pressure_psi,
  li.pressure_state,
  li.valve_cap,
  li.anomaly,
  li.anomaly is not null
    and lower(trim(both from li.anomaly)) <> 'normal' as has_anomaly,
  li.inspector_name,
  u.is_test,
  previous.rtd_movi_mm as prev_inspection_rtd_mm,
  previous.inspected_on as prev_inspection_on,
  li.tire_code as last_inspection_tire_code
from public.v_tire_performance p
join public.companies co on co.id = p.company_id
join public.tire_casings cs on cs.id = p.casing_id
join public.units u on u.id = p.unit_id
left join public.tire_positions tp
  on tp.config_id = u.config_id
  and tp.position_number = p.position_number
left join public.axles ax on ax.id = tp.axle_id
left join lateral (
  select threshold.rtd_removal_mm
  from public.rtd_thresholds threshold
  where threshold.company_id = p.company_id
    and (threshold.size_name = p.size_name or threshold.size_name is null)
  order by threshold.size_name
  limit 1
) rt on true
left join lateral (
  select
    m.inspection_id,
    i.odometer_km,
    m.rtd_a_mm,
    m.rtd_b_mm,
    m.rtd_c_mm,
    m.rtd_d_mm,
    m.rtd_movi_mm,
    m.rtd_state,
    m.pressure_psi,
    m.pressure_state,
    m.valve_cap,
    m.anomaly,
    m.tire_code,
    pr.full_name as inspector_name
  from public.inspection_measurements m
  join public.inspections i on i.id = m.inspection_id
  left join public.profiles pr on pr.id = i.inspector_id
  where i.unit_id = p.unit_id
    and m.position_number = p.position_number
  order by i.inspected_on desc
  limit 1
) li on true
left join lateral (
  select
    m.rtd_movi_mm,
    i.inspected_on
  from public.inspection_measurements m
  join public.inspections i on i.id = m.inspection_id
  where i.unit_id = p.unit_id
    and m.position_number = p.position_number
    and i.inspected_on >= p.installed_at::date
    and i.inspected_on < p.last_inspection_on
  order by i.inspected_on desc
  limit 1
) previous on true;

comment on view public.v_rendimiento_dashboard_rows is
  'Fila por instalación activa para Rendimiento. Las columnas finales prev_inspection_rtd_mm, prev_inspection_on y last_inspection_tire_code permiten declarar RTD creciente sin ocultar ni inferir cambios de neumático.';
