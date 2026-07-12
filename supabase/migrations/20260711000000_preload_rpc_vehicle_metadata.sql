-- RENOVA — task_15: agregar vehicle_type/notation reales al RPC get_unidad_preload
-- para que la app deje de adivinar (inferConfig() + 'BUS' hardcodeado en
-- app/src/sync/preloadUnidadFromSupabase.ts). El dato ya existe en units.vehicle_type
-- y vehicle_configs.notation (via units.config_id) — solo faltaba exponerlo.

drop function if exists public.get_unidad_preload(text, text);

create function public.get_unidad_preload(p_company_name text, p_plate text)
returns table (
  plate               text,
  inspected_on        date,
  odometer_km         integer,
  unit_photo_url      text,
  vehicle_type        text,
  notation            text,
  position_number     smallint,
  tire_code           text,
  casing_code         text,
  brand_name          text,
  condition           text,
  retread_design      text,
  size_name           text,
  rtd_a_mm            numeric,
  rtd_b_mm            numeric,
  rtd_c_mm            numeric,
  rtd_d_mm            numeric,
  pressure_psi        numeric,
  valve_cap           text,
  anomaly             text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    u.plate,
    i.inspected_on,
    i.odometer_km,
    i.unit_photo_url,
    u.vehicle_type,
    vc.notation,
    im.position_number,
    im.tire_code,
    cs.code as casing_code,
    im.brand_name,
    im.condition,
    im.retread_design,
    im.size_name,
    im.rtd_a_mm,
    im.rtd_b_mm,
    im.rtd_c_mm,
    im.rtd_d_mm,
    im.pressure_psi,
    im.valve_cap,
    im.anomaly
  from public.units u
  join public.companies co on co.id = u.company_id
  join public.vehicle_configs vc on vc.id = u.config_id
  join public.inspections i on i.unit_id = u.id
  join public.inspection_measurements im on im.inspection_id = i.id
  left join public.tire_life_cycles lc on lc.id = im.life_cycle_id
  left join public.tire_casings cs on cs.id = lc.casing_id
  where lower(co.name) = lower(p_company_name)
    and u.plate = p_plate
  order by i.inspected_on desc, im.position_number asc;
$$;

comment on function public.get_unidad_preload(text, text) is
  'Solo lectura para preloadUnidadFromSupabase.ts: precarga en el dispositivo la última inspección de UNA unidad de UNA empresa puntual, incluyendo vehicle_type/notation reales (task_15). SECURITY DEFINER de alcance acotado — mismo criterio que save_inspection().';

grant execute on function public.get_unidad_preload(text, text) to anon, authenticated;
