-- Expone model_name ya capturado en inspection_measurements para que
-- Inspecciones pueda filtrar por modelo. Cambio aditivo: conserva la misma
-- vista, seguridad invoker, joins y lógica de estado; solo agrega la columna.
create or replace view public.v_inspection_dashboard_rows
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
  im.updated_at,
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
  end as tire_status,
  case
    when im.is_discard or public.fn_anomaly_is_severe(im.anomaly) then 'desecho'
    when im.rtd_movi_mm is not null and th.rtd_change_mm is not null then
      case
        when im.rtd_movi_mm <= th.rtd_change_mm then 'para_reencauche'
        when im.rtd_movi_mm <= th.rtd_next_mm then 'proximo_a_reencauche'
        else null
      end
    when im.rtd_state = 'Para Reencauche'::rtd_state then 'para_reencauche'
    when im.rtd_state = 'Próximo a Reencauche'::rtd_state then 'proximo_a_reencauche'
    else null
  end as retread_observation,
  -- CREATE OR REPLACE VIEW solo permite ampliar al final sin alterar la
  -- posición de columnas que ya consumen clientes existentes.
  im.model_name
from inspections i
  join companies co on co.id = i.company_id
  join units u on u.id = i.unit_id
  join inspection_measurements im on im.inspection_id = i.id
  left join tire_life_cycles lc on lc.id = im.life_cycle_id
  left join tire_casings cs on cs.id = lc.casing_id
  left join tire_positions tp on tp.config_id = u.config_id and tp.position_number = im.position_number
  left join axles ax on ax.id = tp.axle_id
  left join profiles p on p.id = i.inspector_id
  left join lateral fn_effective_rtd_thresholds(i.company_id, im.size_name) th(rtd_change_mm, rtd_next_mm, rtd_removal_mm) on true;

grant select on public.v_inspection_dashboard_rows to anon, authenticated;
