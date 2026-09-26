-- RENOVA — las RPC móviles exigen inspector autenticado y empresa del perfil.
-- La clave publicable identifica al cliente; nunca debe conceder acceso a datos.
-- Mantiene las firmas RPC para no romper las versiones instaladas de la app.

-- La aplicación ya no usa acceso anónimo: revoca grants heredados
-- sobre tablas y secuencias; las vistas quedan para authenticated.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
drop policy if exists select_companies_anon on public.companies;

-- Las migraciones del repositorio se aplican como postgres. Retira los grants
-- anon heredados en tablas, secuencias y funciones que cree ese rol a futuro.
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke execute on functions from anon;
alter default privileges for role postgres revoke execute on functions from public;

-- Retira EXECUTE anon/PUBLIC de las funciones de aplicación existentes creadas
-- por postgres; mantiene los grants explícitos de authenticated/service_role.
do $$
declare
  v_function record;
begin
  for v_function in
    select p.oid::regprocedure as function_signature
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proowner = 'postgres'::regrole
  loop
    execute format('revoke execute on function %s from anon, public', v_function.function_signature);
  end loop;
end;
$$;

-- Las vistas security_invoker dependen de estas funciones al leer dashboards.
-- Al retirar el EXECUTE heredado de PUBLIC, concede acceso explícito al rol
-- autenticado para mantener el mismo contrato con RLS aplicado al llamador.
grant execute on function public.fn_anomaly_is_severe(text) to authenticated;
grant execute on function public.fn_channel_rtd_state(uuid, text, numeric) to authenticated;
grant execute on function public.fn_effective_rtd_thresholds(uuid, text) to authenticated;
grant execute on function public.fn_pressure_state_fixed(numeric) to authenticated;
grant execute on function public.fn_rtd_state(uuid, text, numeric) to authenticated;

create or replace function public.get_unidad_preload(p_company_name text, p_plate text)
returns table (
  plate text,
  inspected_on date,
  odometer_km integer,
  unit_photo_url text,
  vehicle_type text,
  notation text,
  position_number smallint,
  tire_code text,
  casing_code text,
  brand_name text,
  model_name text,
  condition text,
  retread_design text,
  size_name text,
  rtd_a_mm numeric,
  rtd_b_mm numeric,
  rtd_c_mm numeric,
  rtd_d_mm numeric,
  pressure_psi numeric,
  valve_cap text,
  anomaly text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_company_name text;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Se requiere una sesión autenticada.';
  end if;

  select c.id, c.name
    into v_company_id, v_company_name
    from public.profiles p
    join public.companies c on c.id = p.company_id
   where p.id = auth.uid()
     and p.active
     and p.role = 'inspector'
     and c.active;

  if v_company_id is null then
    raise exception using errcode = '42501', message = 'Se requiere un perfil activo de inspector.';
  end if;

  if nullif(btrim(p_company_name), '') is null
     or lower(btrim(p_company_name)) <> lower(v_company_name) then
    raise exception using errcode = '42501', message = 'La empresa solicitada no coincide con la sesión.';
  end if;

  return query
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
    im.model_name,
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
  join lateral (
    select i0.*
    from public.inspections i0
    where i0.unit_id = u.id
    order by i0.inspected_on desc, i0.updated_at desc nulls last,
      i0.created_at desc, i0.id desc
    limit 1
  ) i on true
  join public.inspection_measurements im on im.inspection_id = i.id
  left join public.tire_life_cycles lc on lc.id = im.life_cycle_id
  left join public.tire_casings cs on cs.id = lc.casing_id
  where u.company_id = v_company_id
    and u.plate = p_plate
  order by im.position_number asc;
end;
$$;

comment on function public.get_unidad_preload(text, text) is
  'Preload de una unidad para inspectores autenticados; deriva la empresa del perfil y rechaza empresas distintas a la sesión.';

revoke all on function public.get_unidad_preload(text, text) from public, anon, authenticated;
grant execute on function public.get_unidad_preload(text, text) to authenticated;

create or replace function public.get_umbrales_rtd(p_company_name text)
returns table (
  size_name text,
  rtd_change_mm numeric,
  rtd_next_mm numeric,
  rtd_removal_mm numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_company_name text;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Se requiere una sesión autenticada.';
  end if;

  select c.id, c.name
    into v_company_id, v_company_name
    from public.profiles p
    join public.companies c on c.id = p.company_id
   where p.id = auth.uid()
     and p.active
     and p.role = 'inspector'
     and c.active;

  if v_company_id is null then
    raise exception using errcode = '42501', message = 'Se requiere un perfil activo de inspector.';
  end if;

  if nullif(btrim(p_company_name), '') is null
     or lower(btrim(p_company_name)) <> lower(v_company_name) then
    raise exception using errcode = '42501', message = 'La empresa solicitada no coincide con la sesión.';
  end if;

  return query
    select rt.size_name, rt.rtd_change_mm, rt.rtd_next_mm, rt.rtd_removal_mm
      from public.rtd_thresholds rt
     where rt.company_id = v_company_id;
end;
$$;

comment on function public.get_umbrales_rtd(text) is
  'Umbrales RTD de la empresa asignada al inspector autenticado; rechaza cualquier empresa distinta a la sesión.';

revoke all on function public.get_umbrales_rtd(text) from public, anon, authenticated;
grant execute on function public.get_umbrales_rtd(text) to authenticated;

-- "R" suelto (sin número) en la columna CONDICIÓN del Excel se interpreta
-- como R1 (primer reencauche) — confirmado 2026-07-10 para el caso de
-- ITTSABUS (6 filas con CONDICIÓN='R' y DISEÑO ACTUAL lleno, ambiguo entre
-- R1/R2 pero R1 es el caso más común). No cambia el resto de la validación
-- (N/R1/R2/R3/R4 exactos, o 'nuev%' -> N).
create or replace function public.save_inspection(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  v_company   public.companies%rowtype;
  v_unit      public.units%rowtype;
  v_config_id uuid;
  v_inspection_id uuid;
  v_local_id  uuid;
  v_plate     text;
  v_date      date;
  v_odo       integer;
  item        jsonb;
  v_count     integer := 0;
  v_pos       smallint;
  v_code_raw  text;
  v_code      text;
  v_movi      numeric;
  v_lc        uuid;
  v_cond      public.tire_condition;
  v_state     public.rtd_state;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Se requiere una sesión autenticada.';
  end if;

  if coalesce(payload->>'captured_by_user_id', '') <> auth.uid()::text then
    raise exception using errcode = '42501', message = 'La inspección pertenece a otra sesión.';
  end if;

  select c.*
    into v_company
    from public.profiles p
    join public.companies c on c.id = p.company_id
   where p.id = auth.uid()
     and p.active
     and p.role = 'inspector'
     and c.active;

  if v_company.id is null then
    raise exception using errcode = '42501', message = 'Se requiere un perfil activo de inspector.';
  end if;

  if nullif(btrim(payload->>'company_name'), '') is not null
     and lower(btrim(payload->>'company_name')) <> lower(v_company.name) then
    raise exception using errcode = '42501', message = 'La empresa de la inspección no coincide con la sesión.';
  end if;

  v_plate := nullif(trim(payload->>'plate_number'), '');
  v_date  := (payload->>'inspection_date')::date;
  v_odo   := (payload->>'odometer_km')::integer;
  if v_plate is null then raise exception 'save_inspection: plate_number requerido'; end if;
  if v_date  is null then raise exception 'save_inspection: inspection_date requerida'; end if;
  if v_odo   is null then raise exception 'save_inspection: odometer_km requerido'; end if;

  begin
    v_local_id := nullif(payload->>'local_id','')::uuid;
  exception when others then
    v_local_id := null;
  end;

  select * into v_unit from public.units
   where company_id = v_company.id and plate = v_plate;
  if v_unit.id is null then
    select id into v_config_id from public.vehicle_configs
     where notation = payload->>'configuration' limit 1;
    if v_config_id is null then
      select id into v_config_id from public.vehicle_configs
       where notation = '2-4-2' limit 1;
    end if;
    insert into public.units (company_id, plate, vehicle_type, config_id, status)
    values (v_company.id, v_plate, coalesce(nullif(payload->>'vehicle_type',''),'BUS'),
            v_config_id, 'pending_validation')
    returning * into v_unit;
  end if;

  select id into v_inspection_id from public.inspections
   where unit_id = v_unit.id and inspected_on = v_date;
  if v_inspection_id is not null then
    update public.inspections
       set odometer_km = v_odo, updated_at = now()
     where id = v_inspection_id;
  else
    insert into public.inspections (id, company_id, unit_id, inspected_on, odometer_km, inspector_id, device_created_at)
    values (coalesce(v_local_id, gen_random_uuid()), v_company.id, v_unit.id, v_date, v_odo, auth.uid(), now())
    on conflict (id) do update
      set odometer_km = excluded.odometer_km,
          inspector_id = coalesce(public.inspections.inspector_id, excluded.inspector_id),
          updated_at = now()
      where public.inspections.company_id = excluded.company_id
        and public.inspections.unit_id = excluded.unit_id
        and public.inspections.inspected_on = excluded.inspected_on
    returning id into v_inspection_id;
    if v_inspection_id is null then
      raise exception using errcode = '42501', message = 'El identificador de inspección no pertenece a esta unidad y empresa.';
    end if;
  end if;

  update public.units
     set last_odometer     = greatest(coalesce(last_odometer, 0), v_odo),
         last_inspected_at = greatest(coalesce(last_inspected_at, v_date), v_date),
         updated_at        = now()
   where id = v_unit.id;

  for item in select * from jsonb_array_elements(coalesce(payload->'items', '[]'::jsonb)) loop
    v_pos := nullif(regexp_replace(item->>'position', '[^0-9]', '', 'g'), '')::smallint;
    continue when v_pos is null;

    v_code_raw := nullif(trim(item->>'tire_code'), '');
    v_code := case when upper(coalesce(v_code_raw,'')) in ('N/V','NV','N-V') then null
                   else v_code_raw end;

    v_movi := coalesce(
      (item->>'rtd_movi')::numeric,
      least((item->>'rtd_a')::numeric, (item->>'rtd_b')::numeric,
            (item->>'rtd_c')::numeric, (item->>'rtd_d')::numeric)
    );

    v_lc := null;
    select ti.life_cycle_id into v_lc
      from public.tire_installations ti
     where ti.unit_id = v_unit.id and ti.position_number = v_pos and not ti.removed
     order by ti.installed_at desc
     limit 1;

    v_cond := case
      when upper(coalesce(item->>'tire_condition','')) in ('N','R1','R2','R3','R4')
        then upper(item->>'tire_condition')::public.tire_condition
      when upper(trim(coalesce(item->>'tire_condition',''))) = 'R'
        then 'R1'::public.tire_condition
      when item->>'tire_condition' ilike 'nuev%' then 'N'::public.tire_condition
      else null
    end;

    v_state := public.fn_rtd_state(v_company.id, item->>'tire_size', v_movi);

    insert into public.inspection_measurements (
      id, company_id, inspection_id, position_number, life_cycle_id,
      tire_code, brand_name, model_name, size_name, condition, retread_design,
      rtd_a_mm, rtd_b_mm, rtd_c_mm, rtd_d_mm,
      pressure_psi, valve_cap, anomaly,
      rtd_movi_mm, rtd_state, pressure_state, is_discard, device_updated_at
    ) values (
      gen_random_uuid(), v_company.id, v_inspection_id, v_pos, v_lc,
      v_code,
      nullif(item->>'tire_brand',''),
      nullif(item->>'original_design',''),
      nullif(item->>'tire_size',''),
      v_cond,
      nullif(item->>'current_design',''),
      (item->>'rtd_a')::numeric, (item->>'rtd_b')::numeric,
      (item->>'rtd_c')::numeric, (item->>'rtd_d')::numeric,
      (item->>'pressure')::numeric,
      nullif(item->>'valve_cap',''),
      nullif(item->>'tire_anomaly',''),
      v_movi,
      v_state,
      case when (item->>'pressure') is null then 'Sin Medir'::public.pressure_state
           else null end,
      coalesce((item->>'scrap')::boolean, false),
      now()
    )
    on conflict (inspection_id, position_number) do update set
      life_cycle_id  = excluded.life_cycle_id,
      tire_code      = excluded.tire_code,
      brand_name     = excluded.brand_name,
      model_name     = excluded.model_name,
      size_name      = excluded.size_name,
      condition      = excluded.condition,
      retread_design = excluded.retread_design,
      rtd_a_mm = excluded.rtd_a_mm, rtd_b_mm = excluded.rtd_b_mm,
      rtd_c_mm = excluded.rtd_c_mm, rtd_d_mm = excluded.rtd_d_mm,
      pressure_psi = excluded.pressure_psi,
      valve_cap    = excluded.valve_cap,
      anomaly      = excluded.anomaly,
      rtd_movi_mm  = excluded.rtd_movi_mm,
      rtd_state    = excluded.rtd_state,
      pressure_state = excluded.pressure_state,
      is_discard   = excluded.is_discard,
      device_updated_at = excluded.device_updated_at,
      updated_at   = now();

    v_count := v_count + 1;
  end loop;

  return jsonb_build_object(
    'inspection_id', v_inspection_id,
    'unit_id', v_unit.id,
    'plate', v_plate,
    'inspected_on', v_date,
    'measurements', v_count
  );
end;
$function$;

revoke all on function public.save_inspection(jsonb) from public, anon, authenticated;
grant execute on function public.save_inspection(jsonb) to authenticated;
