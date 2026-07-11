-- v_unit_tire_status/v_fleet_unit_status no traían company_name (solo
-- company_id) — INSPECCIONES POR FECHA.html lo necesita para mostrar la
-- empresa en la tarjeta de unidad (regresión detectada tras conectar el HTML
-- a v_fleet_unit_status en 20260710150000: la tarjeta mostraba "—" en vez de
-- la empresa). DROP CASCADE + recrear las 3 vistas en orden de dependencia
-- (v_fleet_status_summary no cambia de forma, solo se recrea porque cae con
-- el cascade).

drop view if exists public.v_fleet_status_summary cascade;
drop view if exists public.v_fleet_unit_status cascade;
drop view if exists public.v_unit_tire_status cascade;

create view public.v_unit_tire_status as
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
  im.rtd_state as device_rtd_state,
  im.pressure_state,
  th.rtd_change_mm,
  th.rtd_next_mm,
  case
    when im.is_discard then 'critical'
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

create view public.v_fleet_unit_status as
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

create view public.v_fleet_status_summary as
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
