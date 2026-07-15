-- REVERSIÓN de 20260716100000_baseline_provenance_and_helper.sql.
-- Restaura literalmente las definiciones vigentes antes de la migración y
-- elimina solo los objetos aditivos de procedencia y línea base.

-- CREATE OR REPLACE VIEW puede agregar columnas pero no quitarlas. No se usa
-- CASCADE: si una dependencia no versionada impide el drop, el down debe fallar
-- en vez de borrarla en silencio.
drop view public.v_unit_position_state;

create or replace view public.v_unit_position_state
with (security_invoker = true) as
select
  u.company_id,
  u.id as unit_id,
  u.plate,
  u.config_id,
  tp.position_number,
  tp.side,
  a.axle_number,
  a.axle_type,
  tp.is_ground,
  ti.id as installation_id,
  ti.life_cycle_id,
  tlc.casing_id,
  tc.code as casing_code,
  tc.brand_name,
  tc.model_name,
  tc.size_name,
  tlc.condition,
  tlc.retread_design,
  tlc.cycle_number,
  ti.installed_at,
  ti.odometer_at_install,
  ti.rtd_at_install_mm,
  ti.id is null as is_empty,
  last_measurement.inspected_on as last_inspected_on,
  last_measurement.rtd_movi_mm as last_rtd_movi_mm,
  last_measurement.pressure_psi as last_pressure_psi,
  last_measurement.tire_code as last_inspection_tire_code,
  ti.id is not null
    and upper(btrim(last_measurement.tire_code))
        is distinct from upper(btrim(tc.code)) as code_mismatch
from public.units u
join public.tire_positions tp
  on tp.config_id = u.config_id
join public.axles a
  on a.id = tp.axle_id
left join public.tire_installations ti
  on ti.unit_id = u.id
 and ti.position_number = tp.position_number
 and not ti.removed
left join public.tire_life_cycles tlc
  on tlc.id = ti.life_cycle_id
left join public.tire_casings tc
  on tc.id = tlc.casing_id
left join lateral (
  select
    i.inspected_on,
    im.rtd_movi_mm,
    im.pressure_psi,
    im.tire_code
  from public.inspections i
  join public.inspection_measurements im
    on im.inspection_id = i.id
  where i.unit_id = u.id
    and im.position_number = tp.position_number
  order by i.inspected_on desc
  limit 1
) last_measurement on true;

comment on view public.v_unit_position_state is
  'Estado de todas las posiciones configuradas de cada unidad. is_empty=true significa que no existe una instalación activa, aunque puede existir una medición legada. code_mismatch=true cuando hay instalación activa y el código de su casco difiere del código de la última inspección tras normalizar ambos con trim/upper; NULL también participa mediante IS DISTINCT FROM.';

revoke all privileges on public.v_unit_position_state
  from public, anon, authenticated;
grant select on public.v_unit_position_state to authenticated;

create or replace function public.register_full_installation(
  p_casing_code    text,
  p_brand_name     text,
  p_model_name     text,
  p_size_name      text,
  p_condition      public.tire_condition,
  p_unit_id        uuid,
  p_position       smallint,
  p_installed_at   date,
  p_retread_design text default null,
  p_otd_mm         numeric default null,
  p_cost           numeric default null,
  p_currency       text default 'PEN',
  p_odometer       integer default null,
  p_rtd_mm         numeric default null,
  p_notes          text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_unit    public.units%rowtype;
  v_code    text;
  v_casing_id uuid;
  v_cycle_id  uuid;
  v_inst_id   uuid;
  v_cycle_number smallint;
begin
  v_profile := public.fn_require_workshop_profile();
  if p_installed_at is null then
    raise exception 'La fecha de instalación es obligatoria.';
  end if;
  if p_condition is null then
    raise exception 'La condición (N, R1, R2…) es obligatoria.';
  end if;
  if p_condition <> 'N' and nullif(trim(coalesce(p_retread_design,'')), '') is null then
    raise exception 'Un neumático % necesita el diseño de reencauche.', p_condition;
  end if;

  v_unit := public.fn_validate_free_position(v_profile.company_id, p_unit_id, p_position);

  v_code := nullif(trim(coalesce(p_casing_code, '')), '');
  if v_code is not null and exists (
    select 1 from public.tire_casings
     where company_id = v_profile.company_id and code = v_code
  ) then
    raise exception 'Ya existe un casco con el código % en tu empresa. Usá "Trasladar" para moverlo.', v_code;
  end if;

  v_cycle_number := case p_condition
    when 'N' then 0 when 'R1' then 1 when 'R2' then 2 when 'R3' then 3 else 4 end;

  insert into public.tire_casings (company_id, code, brand_name, model_name, size_name, notes)
  values (v_profile.company_id, v_code,
          nullif(trim(coalesce(p_brand_name,'')),''),
          nullif(trim(coalesce(p_model_name,'')),''),
          nullif(trim(coalesce(p_size_name,'')),''),
          p_notes)
  returning id into v_casing_id;

  insert into public.tire_life_cycles (
    company_id, casing_id, cycle_number, condition, retread_design,
    otd_mm, cost, currency, started_at
  ) values (
    v_profile.company_id, v_casing_id, v_cycle_number, p_condition,
    nullif(trim(coalesce(p_retread_design,'')),''),
    p_otd_mm, p_cost, coalesce(nullif(trim(p_currency),''),'PEN'), p_installed_at
  ) returning id into v_cycle_id;

  insert into public.tire_installations (
    company_id, life_cycle_id, unit_id, position_number,
    installed_at, odometer_at_install, rtd_at_install_mm, installed_by, notes
  ) values (
    v_profile.company_id, v_cycle_id, p_unit_id, p_position,
    p_installed_at, p_odometer, coalesce(p_rtd_mm, p_otd_mm), v_profile.id, p_notes
  ) returning id into v_inst_id;

  return jsonb_build_object(
    'casing_id', v_casing_id, 'life_cycle_id', v_cycle_id,
    'installation_id', v_inst_id, 'plate', v_unit.plate, 'position', p_position
  );
end;
$$;

revoke all on function public.register_full_installation(text,text,text,text,public.tire_condition,uuid,smallint,date,text,numeric,numeric,text,integer,numeric,text) from public, anon;
grant execute on function public.register_full_installation(text,text,text,text,public.tire_condition,uuid,smallint,date,text,numeric,numeric,text,integer,numeric,text) to authenticated;

drop function public.fn_create_casing_cycle_installation(
  public.profiles, text, text, text, text, public.tire_condition, text,
  numeric, numeric, text, uuid, smallint, date, integer, numeric,
  public.record_origin, uuid, text
);

drop index public.tire_installations_origin_idx;

alter table public.tire_installations
  drop constraint tire_installations_baseline_source_measurement_check,
  drop column source_measurement_id,
  drop column origin;

alter table public.tire_life_cycles
  drop column origin;

alter table public.tire_casings
  drop column origin;

drop type public.record_origin;
