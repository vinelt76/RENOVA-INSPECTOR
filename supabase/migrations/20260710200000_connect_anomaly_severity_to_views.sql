-- Conecta el catálogo de anomalías (anomaly_catalog.desecho) a las vistas del
-- dashboard: el color crítico/naranja ahora también sale de si el TEXTO de la
-- anomalía corresponde a una entrada grave del catálogo, no solo del check
-- manual is_discard. Sigue siendo "OR": is_discard=true también sigue siendo
-- crítico (por si el inspector marcó descarte con una anomalía no catalogada).

-- Helper: resuelve si un texto de anomalía es grave según el catálogo,
-- siguiendo alias_de un nivel (ver anomaly_catalog.alias_de).
create or replace function public.fn_anomaly_is_severe(p_anomaly text)
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(
    (select coalesce(canon.desecho, ac.desecho)
     from anomaly_catalog ac
     left join anomaly_catalog canon on canon.nombre = ac.alias_de
     where lower(trim(ac.nombre)) = lower(trim(p_anomaly))
     limit 1),
    false
  )
$$;

comment on function public.fn_anomaly_is_severe(text) is
  'true si el texto de anomalía corresponde a una entrada desecho=true del catálogo (siguiendo alias_de). false si no matchea o no es grave.';

drop view if exists public.v_inspection_dashboard_rows;

create view public.v_inspection_dashboard_rows
with (security_invoker = true) as
select
  i.company_id,
  co.name as company_name,
  u.id as unit_id,
  u.plate,
  i.id as inspection_id,
  i.inspected_on,
  i.odometer_km,
  i.unit_photo_url,
  im.position_number,
  tp.side,
  ax.axle_number,
  ax.axle_type,
  im.tire_code,
  cs.code as casing_code,
  cs.code_status,
  im.brand_name,
  im.size_name,
  im.condition,
  im.retread_design,
  im.rtd_a_mm,
  im.rtd_b_mm,
  im.rtd_c_mm,
  im.rtd_d_mm,
  im.rtd_movi_mm,
  im.rtd_state,
  public.fn_channel_rtd_state(i.company_id, im.size_name, im.rtd_a_mm) as rtd_a_state,
  public.fn_channel_rtd_state(i.company_id, im.size_name, im.rtd_b_mm) as rtd_b_state,
  public.fn_channel_rtd_state(i.company_id, im.size_name, im.rtd_c_mm) as rtd_c_state,
  public.fn_channel_rtd_state(i.company_id, im.size_name, im.rtd_d_mm) as rtd_d_state,
  im.pressure_psi,
  im.pressure_state,
  public.fn_pressure_state_fixed(im.pressure_psi) as pressure_state_fixed,
  im.valve_cap,
  im.anomaly,
  (im.anomaly is not null and lower(trim(im.anomaly)) <> 'normal') as has_anomaly,
  public.fn_anomaly_is_severe(im.anomaly) as anomaly_is_severe,
  im.anomaly_photo_url,
  im.is_discard,
  (im.is_discard or public.fn_anomaly_is_severe(im.anomaly)) as is_critical,
  p.full_name as inspector_name,
  im.updated_at
from inspections i
  join companies co on co.id = i.company_id
  join units u on u.id = i.unit_id
  join inspection_measurements im on im.inspection_id = i.id
  left join tire_life_cycles lc on lc.id = im.life_cycle_id
  left join tire_casings cs on cs.id = lc.casing_id
  left join tire_positions tp on tp.config_id = u.config_id and tp.position_number = im.position_number
  left join axles ax on ax.id = tp.axle_id
  left join profiles p on p.id = i.inspector_id;

comment on view public.v_inspection_dashboard_rows is
  'Consumida por Inspecciones por unidad.html y rendimiento.html. rtd_a_state..d_state (canal), pressure_state_fixed (100/130), has_anomaly (excluye "Normal"), anomaly_is_severe (catálogo desecho) e is_critical (is_discard OR anomaly_is_severe) — el HTML solo lee y renderiza.';

grant select on public.v_inspection_dashboard_rows to anon, authenticated;

-- v_unit_tire_status: el estado "critical" ahora también dispara si la
-- anomalía es grave por catálogo, no solo por is_discard.
drop view if exists public.v_fleet_status_summary cascade;
drop view if exists public.v_fleet_unit_status cascade;
drop view if exists public.v_unit_tire_status cascade;

create view public.v_unit_tire_status
with (security_invoker = true) as
select
  i.company_id,
  co.name as company_name,
  i.unit_id,
  u.plate,
  i.id as inspection_id,
  i.inspected_on,
  i.odometer_km,
  im.position_number,
  tp.side,
  ax.axle_number,
  ax.axle_type,
  im.tire_code,
  im.rtd_movi_mm,
  im.pressure_psi,
  im.anomaly,
  im.is_discard,
  public.fn_anomaly_is_severe(im.anomaly) as anomaly_is_severe,
  im.rtd_state as device_rtd_state,
  im.pressure_state,
  th.rtd_change_mm,
  th.rtd_next_mm,
  case
    when im.is_discard or public.fn_anomaly_is_severe(im.anomaly) then 'critical'
    when im.rtd_movi_mm is not null and th.rtd_change_mm is not null then
      case
        when im.rtd_movi_mm <= th.rtd_change_mm then 'critical'
        when im.rtd_movi_mm <= th.rtd_next_mm then 'warning'
        else 'normal'
      end
    when im.rtd_state = 'Para Reencauche'::rtd_state then 'critical'
    when im.rtd_state = 'Próximo a Reencauche'::rtd_state then 'warning'
    when im.rtd_state = 'Normal'::rtd_state then 'normal'
    else 'no_data'
  end as tire_status
from inspections i
  join units u on u.id = i.unit_id
  join companies co on co.id = i.company_id
  join inspection_measurements im on im.inspection_id = i.id
  left join tire_positions tp on tp.config_id = u.config_id and tp.position_number = im.position_number
  left join axles ax on ax.id = tp.axle_id
  left join lateral fn_effective_rtd_thresholds(i.company_id, im.size_name) th(rtd_change_mm, rtd_next_mm, rtd_removal_mm) on true;

create view public.v_fleet_unit_status
with (security_invoker = true) as
select
  company_id,
  company_name,
  unit_id,
  plate,
  inspection_id,
  inspected_on,
  odometer_km,
  count(*) as tires_measured,
  min(rtd_movi_mm) as worst_rtd_mm,
  count(*) filter (where tire_status = 'critical') as critical_tires,
  count(*) filter (where tire_status = 'warning') as warning_tires,
  count(*) filter (where tire_status = 'no_data') as no_data_tires,
  case
    when count(*) filter (where tire_status = 'critical') > 0 then 'critical'
    when count(*) filter (where tire_status = 'warning') > 0 then 'warning'
    else 'normal'
  end as unit_status
from v_unit_tire_status s
group by company_id, company_name, unit_id, plate, inspection_id, inspected_on, odometer_km;

create view public.v_fleet_status_summary
with (security_invoker = true) as
select
  company_id,
  inspected_on,
  count(*) as units_inspected,
  count(*) filter (where unit_status = 'critical') as critical_units,
  count(*) filter (where unit_status = 'warning') as warning_units,
  count(*) filter (where unit_status = 'normal') as normal_units,
  round((100.0 * count(*) filter (where unit_status = any (array['critical','warning'])))::numeric / nullif(count(*), 0)::numeric) as pct_at_risk
from v_fleet_unit_status f
group by company_id, inspected_on;

grant select on public.v_unit_tire_status to anon, authenticated;
grant select on public.v_fleet_unit_status to anon, authenticated;
grant select on public.v_fleet_status_summary to anon, authenticated;
