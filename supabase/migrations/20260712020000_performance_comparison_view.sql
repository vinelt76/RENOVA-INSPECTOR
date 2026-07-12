-- RENOVA — Vista fuente del rendimiento comparativo (Fase 6 del módulo web).
--
-- v_comparison_cycle_rows: UNA fila por ciclo de vida con todas las dimensiones
-- comparables (marca, modelo, diseño, condición, medida, eje, posición, ruta,
-- tipo de ruta, asientos) y las métricas ya derivadas en SQL (km del ciclo,
-- km/mm, costo/km, km de vida del casco, causa de retiro final).
--
-- La página agrupa por la dimensión elegida y muestra SIEMPRE el tamaño de
-- muestra; las métricas críticas se calculan acá, no en el navegador.
-- Nada se almacena: todo deriva de eventos (instalaciones/retiros/inspecciones).
--
-- Dimensiones que varían dentro de un ciclo (eje, posición, ruta): se toma la
-- de la instalación con MÁS km del ciclo y se expone *_mixed=true cuando el
-- ciclo pasó por más de un valor — la UI debe advertirlo, nunca ocultarlo.

create or replace view public.v_comparison_cycle_rows
with (security_invoker = true) as
select
  p.life_cycle_id,
  p.company_id,
  p.casing_id,
  p.casing_code,
  p.brand_name,
  cs.model_name,
  p.size_name,
  p.cycle_number,
  p.condition,
  p.retread_design,
  p.status as cycle_status,
  p.started_at,
  p.ended_at,
  p.otd_mm,
  p.cost,
  p.currency,
  p.installations_count,
  p.cycle_km,
  p.km_per_mm,
  p.cost_per_km,
  p.consumption_pct,
  p.rtd_worn_mm,
  p.last_rtd_mm,
  -- Vida completa del casco (todas sus bandas):
  cl.lifetime_km,
  cl.lifetime_cost,
  cl.lifetime_cost_per_km,
  cl.life_cycles_count,
  cl.max_cycle_number as retreads_reached,
  -- Retiro final del ciclo (si lo hay):
  fr.reason as final_removal_reason,
  fr.discard_cause as final_discard_cause,
  (p.status = 'discarded') as is_discarded,
  -- Dimensión eje/posición: la instalación con más km del ciclo.
  dom.position_number as dominant_position,
  dom.axle_type as dominant_axle_type,
  dom.plate as dominant_plate,
  (select count(distinct k2.position_number) > 1
     from public.v_installation_km k2 where k2.life_cycle_id = p.life_cycle_id) as position_mixed,
  -- Dimensión ruta: solo si TODAS las instalaciones del ciclo se atribuyen
  -- 'full' a la misma ruta; si no, NULL + route_mixed para advertir.
  ra.route_name,
  ra.route_type_name,
  ra.seats_count,
  ra.route_quality,
  ra.route_mixed
from public.v_life_cycle_performance p
join public.tire_casings cs on cs.id = p.casing_id
join public.v_casing_lifetime_performance cl on cl.casing_id = p.casing_id
left join lateral (
  select tr.reason, tr.discard_cause
  from public.tire_removals tr
  join public.tire_installations ti on ti.id = tr.installation_id
  where ti.life_cycle_id = p.life_cycle_id
  order by tr.removed_at desc limit 1
) fr on true
left join lateral (
  select k.position_number, k.unit_id, u.plate, ax.axle_type
  from public.v_installation_km k
  join public.units u on u.id = k.unit_id
  left join public.tire_positions tp
         on tp.config_id = u.config_id and tp.position_number = k.position_number
  left join public.axles ax on ax.id = tp.axle_id
  where k.life_cycle_id = p.life_cycle_id
  order by k.km_run desc nulls last, k.installed_at desc
  limit 1
) dom on true
left join lateral (
  select
    case when count(distinct a.route_name) = 1
              and bool_and(a.attribution_quality = 'full')
         then max(a.route_name) end as route_name,
    case when count(distinct a.route_name) = 1
              and bool_and(a.attribution_quality = 'full')
         then max(a.route_type_name) end as route_type_name,
    case when count(distinct a.route_name) = 1
              and bool_and(a.attribution_quality = 'full')
         then max(a.seats_count) end as seats_count,
    case
      when count(*) = 0 or bool_and(a.attribution_quality = 'none') then 'none'
      when count(distinct a.route_name) = 1 and bool_and(a.attribution_quality = 'full') then 'full'
      else 'mixed'
    end as route_quality,
    (count(distinct a.route_name) > 1) as route_mixed
  from public.v_installation_route_attribution a
  where a.life_cycle_id = p.life_cycle_id
) ra on true;

comment on view public.v_comparison_cycle_rows is
  'Fase 6: fila por ciclo de vida con dimensiones (marca/modelo/diseño/condición/medida/eje/posición/ruta/asientos) y métricas SQL (km, km/mm, costo/km, vida del casco, retiro final). La UI agrupa y muestra tamaño de muestra; los valores mezclados se marcan (*_mixed), nunca se ocultan.';
