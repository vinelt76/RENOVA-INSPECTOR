-- Rendimiento pertenece a la vida/ciclo actual del neumático.
--
-- Una rotación, un paso por retén o un traslado entre unidades no reinicia el
-- OTD ni el kilometraje del ciclo. Por eso las tasas usan:
--   RTD gastado = OTD del ciclo - RTD actual
--   Km/mm       = km acumulado del ciclo / RTD gastado
--
-- rtd_at_install_mm y km_run se conservan como hechos de la instalación
-- vigente, pero ya no son la base de las métricas de vida completa.
--
-- Si cualquier instalación del ciclo carece de kilometraje, cycle_km queda
-- NULL. No se publica una suma parcial como si fuera el total del ciclo.

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
  lc.otd_mm - k.last_inspection_rtd_mm as rtd_worn_mm,
  k.km_run,
  case
    when (lc.otd_mm - rt.rtd_removal_mm) > 0
      and k.last_inspection_rtd_mm is not null
    then (lc.otd_mm - k.last_inspection_rtd_mm)
      / (lc.otd_mm - rt.rtd_removal_mm) * 100
  end as consumption_pct,
  case
    when (lc.otd_mm - k.last_inspection_rtd_mm) > 0
      and cyc.cycle_km is not null
    then cyc.cycle_km::numeric
      / (lc.otd_mm - k.last_inspection_rtd_mm)
  end as km_per_mm,
  case
    when (lc.otd_mm - k.last_inspection_rtd_mm) > 0
      and cyc.cycle_km is not null
      and (lc.otd_mm - rt.rtd_removal_mm) > 0
    then cyc.cycle_km::numeric
      / (lc.otd_mm - k.last_inspection_rtd_mm)
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
  select case
    when bool_and(k2.km_run is not null) then sum(k2.km_run)
  end as cycle_km
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
  'Métricas de la vida/ciclo actual: OTD y km acumulado del ciclo sobreviven rotaciones y traslados. Un ciclo con algún tramo sin km queda incompleto (NULL), nunca parcialmente sumado. Costo/km conserva costo del ciclo / km del ciclo hasta resolver D6.';
