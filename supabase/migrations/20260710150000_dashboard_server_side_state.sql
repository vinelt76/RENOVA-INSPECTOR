-- Mueve a Supabase la lógica que hoy vive duplicada (y desincronizada) en los
-- HTML de WEB/: estado de presión, estado por canal individual (A/B/C/D) y
-- filtro de "Normal" como no-anomalía. Los HTML pasan a SOLO leer y renderizar.
--
-- Regla de presión (fija, confirmada 2026-07-10, exclusiva de los dashboards
-- web — NO reemplaza presion_ref/deltas configurables de la app móvil, que
-- siguen pendientes de definición para modo CALIENTE, ver specs/reglas_negocio.md §3):
--   psi <= 100        -> Baja Presión
--   100 < psi <= 130  -> Normal
--   psi > 130         -> Alta Presión
--
-- Regla RTD por canal: mismo umbral que fn_rtd_state (rtd_change_mm / rtd_next_mm
-- efectivos de la empresa), aplicado a cada canal medido, no solo al RTD MOVI.

create or replace function public.fn_pressure_state_fixed(p_psi numeric)
returns pressure_state
language sql
stable
set search_path = public
as $$
  select case
    when p_psi is null then 'Sin Medir'::pressure_state
    when p_psi <= 100  then 'Baja Presión'::pressure_state
    when p_psi > 130   then 'Alta Presión'::pressure_state
    else 'Normal'::pressure_state
  end
$$;

comment on function public.fn_pressure_state_fixed(numeric) is
  'Regla de presión fija (100/130) exclusiva de los dashboards web WEB/*.html. La app móvil sigue usando presion_ref/deltas configurables (specs/reglas_negocio.md §3, CALIENTE pendiente) — no confundir ni fusionar.';

-- Estado de un canal RTD individual con los mismos umbrales efectivos que
-- fn_rtd_state usa para el RTD MOVI de esa posición.
create or replace function public.fn_channel_rtd_state(p_company_id uuid, p_size_name text, p_channel_mm numeric)
returns rtd_state
language sql
stable
set search_path = public
as $$
  select public.fn_rtd_state(p_company_id, p_size_name, p_channel_mm)
$$;

comment on function public.fn_channel_rtd_state(uuid, text, numeric) is
  'Estado de UN canal RTD (A/B/C/D) individual, mismos umbrales efectivos que el RTD MOVI de la posición. Permite iluminar cada canal en el panel de detalle sin recalcular en JS.';

drop view if exists public.v_inspection_dashboard_rows;

-- v_inspection_dashboard_rows: agrega estado por canal, presión fija y
-- has_anomaly (excluye el texto "Normal" que algunas filas del Excel traen
-- en la columna anomalía sin que sea una anomalía real).
-- DROP + CREATE (no CREATE OR REPLACE): Postgres no permite insertar
-- columnas nuevas en medio del SELECT de una vista existente.
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
  im.anomaly_photo_url,
  im.is_discard,
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
  'Consumida por Inspecciones por unidad.html y rendimiento.html. Incluye estado por canal (rtd_a_state..rtd_d_state), presión con regla fija (pressure_state_fixed) y has_anomaly (excluye "Normal" como no-anomalía) — el HTML solo lee y renderiza, ya no recalcula umbrales en JS.';

grant select on public.v_inspection_dashboard_rows to anon, authenticated;

-- v_fleet_unit_status / v_fleet_status_summary ya calculan tire_status/unit_status
-- server-side con umbrales efectivos por empresa (4/7 confirmado 2026-07-10) —
-- no requieren cambios, solo que INSPECCIONES POR FECHA.html las consuma en vez
-- de duplicar tireStatus()/calculateUnitStatus() en JS.
