-- ============================================================================
-- RENOVA INSPECTOR — Run 2: vistas de rendimiento para la demo
-- Ejecutar DESPUÉS de migrations/20260706120000_demo_vertical_slice.sql
-- ============================================================================
-- Regla de oro: las métricas derivadas NUNCA se almacenan a mano — se calculan
-- aquí a partir de eventos (instalaciones, retiros, inspecciones). Si falta un
-- dato fuente, el resultado es NULL ("Sin datos"), jamás un 0 inventado
-- (paridad con computeTire() de rendimiento.html).
--
-- Jerarquía de km:
--   km instalación   = fin_efectivo − odómetro_instalación
--   km ciclo         = Σ km de las instalaciones del ciclo        (arranca en 0 con cada ciclo)
--   km casco         = Σ km de todos los ciclos del casco         (historia completa)
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. v_installation_activity — instalación + su retiro + última inspección
--    dentro de la ventana de la instalación (base de todo lo demás)
-- ─────────────────────────────────────────────────────────────────────────────
create view v_installation_activity as
select
  ti.id                    as installation_id,
  ti.company_id,
  ti.life_cycle_id,
  ti.unit_id,
  ti.position_number,
  ti.installed_at,
  ti.odometer_at_install,
  ti.rtd_at_install_mm,
  ti.removed,
  tr.id                    as removal_id,
  tr.removed_at,
  tr.odometer_at_removal,
  tr.odometer_source       as removal_odometer_source,
  tr.rtd_at_removal_mm,
  li.odometer_km           as last_inspection_km,
  li.inspected_on          as last_inspection_on,
  lr.rtd_movi_mm           as last_inspection_rtd_mm
from tire_installations ti
left join tire_removals tr on tr.installation_id = ti.id
-- última inspección de la unidad dentro de la ventana [instalación, retiro]
left join lateral (
  select i.odometer_km, i.inspected_on
  from inspections i
  where i.unit_id = ti.unit_id
    and i.inspected_on >= ti.installed_at
    and (tr.removed_at is null or i.inspected_on <= tr.removed_at)
  order by i.inspected_on desc
  limit 1
) li on true
-- último RTD MOVI medido en esa posición dentro de la misma ventana
-- (lateral aparte: la última inspección puede no tener RTD cargado)
left join lateral (
  select im.rtd_movi_mm
  from inspections i
  join inspection_measurements im
    on im.inspection_id = i.id
   and im.position_number = ti.position_number
  where i.unit_id = ti.unit_id
    and i.inspected_on >= ti.installed_at
    and (tr.removed_at is null or i.inspected_on <= tr.removed_at)
    and im.rtd_movi_mm is not null
  order by i.inspected_on desc
  limit 1
) lr on true;
comment on view v_installation_activity is
  'Instalación con su retiro (si existe) y la última inspección/RTD dentro de su ventana temporal. Base de v_installation_km y de las vistas de rendimiento.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. v_installation_km — km recorridos por instalación, con fallback documentado
--    fin efectivo: km de retiro manual → última inspección → unknown (NULL)
-- ─────────────────────────────────────────────────────────────────────────────
create view v_installation_km as
select
  a.installation_id,
  a.company_id,
  a.life_cycle_id,
  a.unit_id,
  a.position_number,
  a.installed_at,
  a.odometer_at_install,
  a.rtd_at_install_mm,
  a.removed,
  a.removed_at,
  a.rtd_at_removal_mm,
  a.last_inspection_on,
  a.last_inspection_rtd_mm,
  -- odómetro final efectivo de la instalación
  case
    when a.removal_id is not null and a.odometer_at_removal is not null then a.odometer_at_removal
    else a.last_inspection_km
  end as end_odometer,
  -- origen del odómetro final (regla Run 2: manual | last_inspection | unknown)
  case
    when a.removal_id is not null and a.odometer_at_removal is not null then a.removal_odometer_source
    when a.last_inspection_km is not null then 'last_inspection'::odometer_source
    else 'unknown'::odometer_source
  end as end_odometer_source,
  -- km recorridos = fin efectivo − odómetro de instalación (NULL si falta fuente o es negativo → dato inválido)
  case
    when a.odometer_at_install is not null
     and coalesce(
           case when a.removal_id is not null and a.odometer_at_removal is not null
                then a.odometer_at_removal else a.last_inspection_km end,
           null) is not null
     and coalesce(
           case when a.removal_id is not null and a.odometer_at_removal is not null
                then a.odometer_at_removal else a.last_inspection_km end,
           null) >= a.odometer_at_install
    then coalesce(
           case when a.removal_id is not null and a.odometer_at_removal is not null
                then a.odometer_at_removal else a.last_inspection_km end,
           null) - a.odometer_at_install
  end as km_run
from v_installation_activity a;
comment on view v_installation_km is
  'Km recorridos por instalación. end_odometer_source dice de dónde salió el dato: manual (capturado al desmontar), last_inspection (fallback) o unknown (km_run NULL — nunca 0 inventado).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. v_tire_performance — métricas por posición ACTIVA de una unidad
--    (lo que consume el dashboard Rendimiento hoy alimentado por mock)
-- ─────────────────────────────────────────────────────────────────────────────
create view v_tire_performance as
select
  k.installation_id,
  k.company_id,
  k.unit_id,
  u.plate,
  k.position_number,
  lc.id                    as life_cycle_id,
  lc.cycle_number,
  lc.condition,
  lc.retread_design,
  lc.otd_mm,
  lc.cost,
  lc.currency,
  cs.id                    as casing_id,
  cs.code                  as casing_code,
  cs.brand_name,
  cs.model_name,
  cs.size_name,
  k.installed_at,
  k.odometer_at_install,
  k.rtd_at_install_mm,
  k.last_inspection_on,
  k.last_inspection_rtd_mm as current_rtd_mm,
  k.end_odometer           as current_odometer_km,
  k.end_odometer_source,
  -- RTD Gastado (instalación) = RTD instalación − RTD actual
  (lc.otd_mm - k.last_inspection_rtd_mm)                               as rtd_worn_mm,
  -- Km Recorrido (instalación)
  k.km_run,
  -- % de Consumo = RTD gastado / profundidad útil de ESTA instalación
  case when (lc.otd_mm - rt.rtd_removal_mm) > 0
          and k.last_inspection_rtd_mm is not null
       then (lc.otd_mm - k.last_inspection_rtd_mm)
            / (lc.otd_mm - rt.rtd_removal_mm) * 100 end as consumption_pct,
  -- Km/mm = Km acumulado del ciclo / RTD gastado del ciclo
  case when (lc.otd_mm - k.last_inspection_rtd_mm) > 0 and cyc.cycle_km is not null
       then cyc.cycle_km / (lc.otd_mm - k.last_inspection_rtd_mm) end as km_per_mm,
  -- Km Proyectado = Km/mm × (OTD − RTD retiro); D1: OTD es base del ciclo
  case when (lc.otd_mm - k.last_inspection_rtd_mm) > 0
        and cyc.cycle_km is not null
        and (lc.otd_mm - rt.rtd_removal_mm) > 0
       then cyc.cycle_km / (lc.otd_mm - k.last_inspection_rtd_mm)
            * (lc.otd_mm - rt.rtd_removal_mm) end                       as km_projected,
  -- Km acumulado del CICLO = Σ km de todas las instalaciones del ciclo
  cyc.cycle_km             as cycle_km_accumulated,
  -- Km acumulado del CASCO = Σ km de todos los ciclos del casco
  cas.casing_km            as casing_km_accumulated,
  -- Costo/Km del ciclo = costo del ciclo / km del ciclo (el costo pertenece al ciclo)
  case when lc.cost is not null and cyc.cycle_km > 0
       then lc.cost / cyc.cycle_km end                                   as cost_per_km
from v_installation_km k
join tire_life_cycles lc on lc.id = k.life_cycle_id
join tire_casings cs     on cs.id = lc.casing_id
join units u             on u.id  = k.unit_id
-- umbral de la empresa: fila específica de la medida, si no la default (size_name NULL)
left join lateral (
  select rt.rtd_removal_mm
  from rtd_thresholds rt
  where rt.company_id = k.company_id
    and (rt.size_name = cs.size_name or rt.size_name is null)
  order by rt.size_name nulls last
  limit 1
) rt on true
left join lateral (
  select case
    when bool_and(k2.km_run is not null) then sum(k2.km_run)
  end as cycle_km
  from v_installation_km k2
  where k2.life_cycle_id = lc.id
) cyc on true
left join lateral (
  select sum(k3.km_run) as casing_km
  from v_installation_km k3
  join tire_life_cycles lc3 on lc3.id = k3.life_cycle_id
  where lc3.casing_id = cs.id
) cas on true
where not k.removed;
comment on view v_tire_performance is
  'Métricas de rendimiento por posición activa (fórmulas de rendimiento.html en SQL). Incluye km del ciclo y km de vida del casco. NULL donde falten fuentes.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. v_life_cycle_performance — rendimiento por CICLO de vida (N, R1, R2…)
-- ─────────────────────────────────────────────────────────────────────────────
create view v_life_cycle_performance as
select
  lc.id            as life_cycle_id,
  lc.company_id,
  lc.casing_id,
  cs.code          as casing_code,
  cs.brand_name,
  cs.size_name,
  lc.cycle_number,
  lc.condition,
  lc.retread_design,
  lc.status,
  lc.started_at,
  lc.ended_at,
  lc.otd_mm,
  lc.cost,
  lc.currency,
  count(k.installation_id)                       as installations_count,
  -- Km acumulado del ciclo (cada ciclo arranca en 0)
  sum(k.km_run)                                  as cycle_km,
  -- último RTD conocido del ciclo: última inspección de alguna instalación; si no, RTD del retiro
  lr.last_rtd_mm,
  case when lc.otd_mm is not null and lr.last_rtd_mm is not null
       then lc.otd_mm - lr.last_rtd_mm end       as rtd_worn_mm,
  case when lc.otd_mm > 0 and lr.last_rtd_mm is not null
       then (lc.otd_mm - lr.last_rtd_mm) / lc.otd_mm * 100 end as consumption_pct,
  case when (lc.otd_mm - lr.last_rtd_mm) > 0 and sum(k.km_run) is not null
       then sum(k.km_run) / (lc.otd_mm - lr.last_rtd_mm) end   as km_per_mm,
  case when lc.cost is not null and sum(k.km_run) > 0
       then lc.cost / sum(k.km_run) end          as cost_per_km
from tire_life_cycles lc
join tire_casings cs on cs.id = lc.casing_id
left join v_installation_km k on k.life_cycle_id = lc.id
left join lateral (
  select coalesce(
    (select a.last_inspection_rtd_mm
     from v_installation_activity a
     where a.life_cycle_id = lc.id and a.last_inspection_rtd_mm is not null
     order by a.last_inspection_on desc limit 1),
    (select a2.rtd_at_removal_mm
     from v_installation_activity a2
     where a2.life_cycle_id = lc.id and a2.rtd_at_removal_mm is not null
     order by a2.removed_at desc limit 1)
  ) as last_rtd_mm
) lr on true
group by lc.id, lc.company_id, lc.casing_id, cs.code, cs.brand_name, cs.size_name,
         lc.cycle_number, lc.condition, lc.retread_design, lc.status, lc.started_at,
         lc.ended_at, lc.otd_mm, lc.cost, lc.currency, lr.last_rtd_mm;
comment on view v_life_cycle_performance is
  'Rendimiento por ciclo de vida: km del ciclo (Σ instalaciones), consumo contra el OTD del ciclo, costo/km del ciclo. Un ciclo cerrado conserva su historia para siempre.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. v_casing_lifetime_performance — vida completa del CASCO físico
-- ─────────────────────────────────────────────────────────────────────────────
create view v_casing_lifetime_performance as
select
  cs.id            as casing_id,
  cs.company_id,
  cs.code          as casing_code,
  cs.brand_name,
  cs.model_name,
  cs.size_name,
  cs.status,
  count(distinct lc.id)                          as life_cycles_count,
  max(lc.cycle_number)                           as max_cycle_number,
  -- condición actual = la del ciclo activo (o del último ciclo si está descartado)
  (select lc2.condition from tire_life_cycles lc2
    where lc2.casing_id = cs.id
    order by lc2.cycle_number desc limit 1)      as current_condition,
  -- Km acumulado del casco = Σ km de todos sus ciclos (vida completa)
  sum(k.km_run)                                  as lifetime_km,
  -- Inversión total = neumático nuevo + todos los reencauches (una vez por ciclo)
  tc.lifetime_cost,
  case when tc.lifetime_cost is not null and sum(k.km_run) > 0
       then tc.lifetime_cost / sum(k.km_run) end as lifetime_cost_per_km
from tire_casings cs
left join tire_life_cycles lc on lc.casing_id = cs.id
left join v_installation_km k on k.life_cycle_id = lc.id
left join lateral (
  select sum(lc0.cost) as lifetime_cost
  from tire_life_cycles lc0
  where lc0.casing_id = cs.id
) tc on true
group by cs.id, cs.company_id, cs.code, cs.brand_name, cs.model_name, cs.size_name,
         cs.status, tc.lifetime_cost;
comment on view v_casing_lifetime_performance is
  'Vida completa del casco: cuántos ciclos tuvo, km totales (Σ de todos los ciclos), inversión total y costo/km de por vida. La métrica que justifica (o no) seguir reencauchando.';
