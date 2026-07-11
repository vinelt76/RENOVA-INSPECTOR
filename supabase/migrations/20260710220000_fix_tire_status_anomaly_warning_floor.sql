-- BUG: tire_status ignoraba anomalías no-críticas (has_anomaly=true pero
-- anomaly_is_severe=false) cuando el RTD ya era "normal" — la posición
-- quedaba verde con una anomalía activa sin ninguna señal visual. Ahora:
-- si hay anomalía presente (no null, no "Normal") y no es crítica, el piso
-- mínimo es "warning" (amarillo), salvo que el RTD ya sea peor por su cuenta.
-- Mismo criterio que estadoEfectivo() en Inspecciones por unidad.html.

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
  (im.anomaly is not null and lower(trim(im.anomaly)) <> 'normal') as has_anomaly,
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
        when im.anomaly is not null and lower(trim(im.anomaly)) <> 'normal' then 'warning'
        else 'normal'
      end
    when im.rtd_state = 'Para Reencauche'::rtd_state then 'critical'
    when im.rtd_state = 'Próximo a Reencauche'::rtd_state then 'warning'
    when im.rtd_state = 'Normal'::rtd_state then
      case
        when im.anomaly is not null and lower(trim(im.anomaly)) <> 'normal' then 'warning'
        else 'normal'
      end
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
