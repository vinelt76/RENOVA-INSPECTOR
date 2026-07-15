-- RENOVA — Procedencia explícita y evidencia de línea base para Movimientos.
--
-- Sin procedencia, una instalación confirmada desde una inspección histórica y
-- un montaje físico de taller quedan representados por la misma fila. El origen
-- hace visible esa diferencia sin presentar como observada la fecha declarada
-- del primer montaje. También se extrae el helper compartido para que el flujo
-- de primer montaje no duplique los tres INSERT de register_full_installation.

-- ─────────────────────────────────────────────────────────────────────────────
-- A. Procedencia auditable, con compatibilidad para las filas de taller.
-- ─────────────────────────────────────────────────────────────────────────────
create type public.record_origin as enum ('workshop', 'baseline');

comment on type public.record_origin is
  'Procedencia de un registro de neumático. workshop es una operación de taller; baseline es una identidad confirmada por una persona desde evidencia de inspección y no afirma que installed_at haya sido observado.';

alter table public.tire_casings
  add column origin public.record_origin not null default 'workshop';

alter table public.tire_life_cycles
  add column origin public.record_origin not null default 'workshop';

alter table public.tire_installations
  add column origin public.record_origin not null default 'workshop',
  add column source_measurement_id uuid references public.inspection_measurements(id),
  add constraint tire_installations_baseline_source_measurement_check
    check (origin <> 'baseline' or source_measurement_id is not null);

comment on column public.tire_casings.origin is
  'Procedencia del casco. baseline identifica una línea base confirmada por una persona; no convierte en observada la fecha declarada de su instalación.';
comment on column public.tire_life_cycles.origin is
  'Procedencia del ciclo. baseline identifica una línea base confirmada por una persona; no convierte en observada la fecha declarada de su instalación.';
comment on column public.tire_installations.origin is
  'Procedencia de la instalación. baseline exige source_measurement_id: la identidad fue confirmada por una persona desde evidencia de inspección, pero installed_at es una fecha declarada, no observada.';
comment on column public.tire_installations.source_measurement_id is
  'Medición de inspección que respalda una instalación origin=baseline. No prueba la fecha declarada de instalación.';

create index tire_installations_origin_idx
  on public.tire_installations (origin)
  where origin = 'baseline';

comment on index public.tire_installations_origin_idx is
  'Acelera las lecturas de instalaciones de línea base; no afirma que su fecha de montaje haya sido observada.';

-- ─────────────────────────────────────────────────────────────────────────────
-- B. Inserción compartida de casco + ciclo + instalación.
--
-- Es un helper interno: register_full_installation conserva exactamente su
-- contrato y el primer montaje reutilizará este único cuerpo transaccional.
-- ─────────────────────────────────────────────────────────────────────────────
create function public.fn_create_casing_cycle_installation(
  p_profile               public.profiles,
  p_casing_code           text,
  p_brand_name            text,
  p_model_name            text,
  p_size_name             text,
  p_condition             public.tire_condition,
  p_retread_design        text,
  p_otd_mm                numeric,
  p_cost                  numeric,
  p_currency              text,
  p_unit_id               uuid,
  p_position              smallint,
  p_installed_at          date,
  p_odometer              integer,
  p_rtd_mm                numeric,
  p_origin                public.record_origin,
  p_source_measurement_id uuid,
  p_notes                 text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unit public.units%rowtype;
  v_code text;
  v_casing_id uuid;
  v_cycle_id uuid;
  v_inst_id uuid;
  v_cycle_number smallint;
begin
  if p_installed_at is null then
    raise exception 'La fecha de instalación es obligatoria.';
  end if;
  if p_condition is null then
    raise exception 'La condición (N, R1, R2…) es obligatoria.';
  end if;
  if p_condition <> 'N' and nullif(trim(coalesce(p_retread_design, '')), '') is null then
    raise exception 'Un neumático % necesita el diseño de reencauche.', p_condition;
  end if;

  v_unit := public.fn_validate_free_position(p_profile.company_id, p_unit_id, p_position);

  v_code := nullif(trim(coalesce(p_casing_code, '')), '');
  if v_code is not null and exists (
    select 1
    from public.tire_casings
    where company_id = p_profile.company_id
      and code = v_code
  ) then
    raise exception 'Ya existe un casco con el código % en tu empresa. Usá "Trasladar" para moverlo.', v_code;
  end if;

  v_cycle_number := case p_condition
    when 'N' then 0 when 'R1' then 1 when 'R2' then 2 when 'R3' then 3 else 4 end;

  insert into public.tire_casings (
    company_id, code, brand_name, model_name, size_name, notes, origin
  ) values (
    p_profile.company_id, v_code,
    nullif(trim(coalesce(p_brand_name, '')), ''),
    nullif(trim(coalesce(p_model_name, '')), ''),
    nullif(trim(coalesce(p_size_name, '')), ''),
    p_notes, p_origin
  )
  returning id into v_casing_id;

  insert into public.tire_life_cycles (
    company_id, casing_id, cycle_number, condition, retread_design,
    otd_mm, cost, currency, started_at, origin
  ) values (
    p_profile.company_id, v_casing_id, v_cycle_number, p_condition,
    nullif(trim(coalesce(p_retread_design, '')), ''),
    p_otd_mm, p_cost, coalesce(nullif(trim(p_currency), ''), 'PEN'), p_installed_at,
    p_origin
  )
  returning id into v_cycle_id;

  insert into public.tire_installations (
    company_id, life_cycle_id, unit_id, position_number,
    installed_at, odometer_at_install, rtd_at_install_mm, installed_by, notes,
    origin, source_measurement_id
  ) values (
    p_profile.company_id, v_cycle_id, p_unit_id, p_position,
    p_installed_at, p_odometer, coalesce(p_rtd_mm, p_otd_mm), p_profile.id, p_notes,
    p_origin, p_source_measurement_id
  )
  returning id into v_inst_id;

  return jsonb_build_object(
    'casing_id', v_casing_id,
    'life_cycle_id', v_cycle_id,
    'installation_id', v_inst_id,
    'plate', v_unit.plate,
    'position', p_position
  );
end;
$$;

comment on function public.fn_create_casing_cycle_installation(
  public.profiles, text, text, text, text, public.tire_condition, text,
  numeric, numeric, text, uuid, smallint, date, integer, numeric,
  public.record_origin, uuid, text
) is
  'Helper interno que crea casco, ciclo e instalación en una transacción. origin=baseline solo registra una identidad confirmada por una persona y su medición fuente; installed_at sigue siendo fecha declarada, no observada.';

revoke all on function public.fn_create_casing_cycle_installation(
  public.profiles, text, text, text, text, public.tire_condition, text,
  numeric, numeric, text, uuid, smallint, date, integer, numeric,
  public.record_origin, uuid, text
) from public, anon, authenticated;

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
begin
  v_profile := public.fn_require_workshop_profile();

  return public.fn_create_casing_cycle_installation(
    p_profile               => v_profile,
    p_casing_code           => p_casing_code,
    p_brand_name            => p_brand_name,
    p_model_name            => p_model_name,
    p_size_name             => p_size_name,
    p_condition             => p_condition,
    p_retread_design        => p_retread_design,
    p_otd_mm                => p_otd_mm,
    p_cost                  => p_cost,
    p_currency              => p_currency,
    p_unit_id               => p_unit_id,
    p_position              => p_position,
    p_installed_at          => p_installed_at,
    p_odometer              => p_odometer,
    p_rtd_mm                => p_rtd_mm,
    p_origin                => 'workshop'::public.record_origin,
    p_source_measurement_id => null,
    p_notes                 => p_notes
  );
end;
$$;

revoke all on function public.register_full_installation(
  text, text, text, text, public.tire_condition, uuid, smallint, date,
  text, numeric, numeric, text, integer, numeric, text
) from public, anon;
grant execute on function public.register_full_installation(
  text, text, text, text, public.tire_condition, uuid, smallint, date,
  text, numeric, numeric, text, integer, numeric, text
) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- C. Estado de posiciones: las 28 columnas existentes quedan intactas y las
-- nueve evidencias nuevas se agregan al final para no romper a los consumidores.
-- ─────────────────────────────────────────────────────────────────────────────
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
        is distinct from upper(btrim(tc.code)) as code_mismatch,
  ti.origin as installation_origin,
  ti.id is null and last_measurement.measurement_id is not null as baseline_pending,
  last_measurement.measurement_id as last_measurement_id,
  last_measurement.brand_name as last_brand_name,
  last_measurement.model_name as last_model_name,
  last_measurement.size_name as last_size_name,
  last_measurement.condition as last_condition,
  last_measurement.retread_design as last_retread_design,
  last_measurement.odometer_km as last_odometer_km
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
    im.id as measurement_id,
    i.inspected_on,
    i.odometer_km,
    im.rtd_movi_mm,
    im.pressure_psi,
    im.tire_code,
    im.brand_name,
    im.model_name,
    im.size_name,
    im.condition,
    im.retread_design
  from public.inspections i
  join public.inspection_measurements im
    on im.inspection_id = i.id
  where i.unit_id = u.id
    and im.position_number = tp.position_number
  order by i.inspected_on desc
  limit 1
) last_measurement on true;

comment on view public.v_unit_position_state is
  'Estado de todas las posiciones configuradas de cada unidad. is_empty=true significa que no existe una instalación activa, aunque puede existir una medición legada. baseline_pending=true identifica una posición vacía con evidencia de inspección que requiere primer montaje; installation_origin=baseline significa identidad confirmada por una persona y fecha de montaje declarada, no observada. code_mismatch=true cuando hay instalación activa y el código de su casco difiere del código de la última inspección tras normalizar ambos con trim/upper; NULL también participa mediante IS DISTINCT FROM.';

revoke all privileges on public.v_unit_position_state
  from public, anon, authenticated;
grant select on public.v_unit_position_state to authenticated;
