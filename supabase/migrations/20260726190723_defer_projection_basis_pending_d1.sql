-- D1 fue reabierta durante la ejecución de la fase: los datos actuales tienen
-- rtd_at_install_mm = otd_mm y no permiten decidir cómo proyectar un casco
-- montado usado. Esta migración deja aplicada únicamente la corrección probada
-- (desgaste sobre profundidad útil) y restablece OTD como base vigente.
--
-- Supersede 20260726184018_align_tire_performance_useful_depth sin borrar su
-- historial. Cuando RENOVA responda D1, una migración nueva fijará la elección.

create or replace view public.v_tire_performance
with (security_invoker = true)
as
select
  k.installation_id,
  k.company_id,
  k.unit_id,
  u.plate,
  k.position_number,
  lc.id as life_cycle_id,
  lc.cycle_number,
  lc.condition,
  lc.retread_design,
  lc.otd_mm,
  lc.cost,
  lc.currency,
  cs.id as casing_id,
  cs.code as casing_code,
  cs.brand_name,
  cs.model_name,
  cs.size_name,
  k.installed_at,
  k.odometer_at_install,
  k.rtd_at_install_mm,
  k.last_inspection_on,
  k.last_inspection_rtd_mm as current_rtd_mm,
  k.end_odometer as current_odometer_km,
  k.end_odometer_source,
  k.rtd_at_install_mm - k.last_inspection_rtd_mm as rtd_worn_mm,
  k.km_run,
  case
    when (lc.otd_mm - rt.rtd_removal_mm) > 0
      and k.last_inspection_rtd_mm is not null
    then (k.rtd_at_install_mm - k.last_inspection_rtd_mm)
      / (lc.otd_mm - rt.rtd_removal_mm) * 100
  end as consumption_pct,
  case
    when (k.rtd_at_install_mm - k.last_inspection_rtd_mm) > 0
      and k.km_run is not null
    then k.km_run::numeric
      / (k.rtd_at_install_mm - k.last_inspection_rtd_mm)
  end as km_per_mm,
  case
    when (k.rtd_at_install_mm - k.last_inspection_rtd_mm) > 0
      and k.km_run is not null
      and (lc.otd_mm - rt.rtd_removal_mm) > 0
    then k.km_run::numeric
      / (k.rtd_at_install_mm - k.last_inspection_rtd_mm)
      * (lc.otd_mm - rt.rtd_removal_mm)
  end as km_projected,
  cyc.cycle_km as cycle_km_accumulated,
  cas.casing_km as casing_km_accumulated,
  case
    when lc.cost is not null and cyc.cycle_km > 0
    then lc.cost / cyc.cycle_km::numeric
  end as cost_per_km
from public.v_installation_km k
join public.tire_life_cycles lc on lc.id = k.life_cycle_id
join public.tire_casings cs on cs.id = lc.casing_id
join public.units u on u.id = k.unit_id
left join lateral (
  select threshold.rtd_removal_mm
  from public.rtd_thresholds threshold
  where threshold.company_id = k.company_id
    and (threshold.size_name = cs.size_name or threshold.size_name is null)
  order by threshold.size_name
  limit 1
) rt on true
left join lateral (
  select sum(k2.km_run) as cycle_km
  from public.v_installation_km k2
  where k2.life_cycle_id = lc.id
) cyc on true
left join lateral (
  select sum(k3.km_run) as casing_km
  from public.v_installation_km k3
  join public.tire_life_cycles lc3 on lc3.id = k3.life_cycle_id
  where lc3.casing_id = cs.id
) cas on true
where not k.removed;

comment on view public.v_tire_performance is
  'Métricas por instalación activa. Desgaste usa profundidad útil OTD menos umbral mientras D1 siga abierta; km proyectado conserva la misma base. Costo/km conserva costo del ciclo / km del ciclo hasta resolver D6.';
