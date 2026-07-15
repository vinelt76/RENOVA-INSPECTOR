-- RENOVA — Primer montaje confirmado y gate de línea base.
-- Requiere 20260716100000_baseline_provenance_and_helper.sql.

create table public.baseline_mount_batches (
  id uuid primary key,
  company_id uuid not null references public.companies(id),
  unit_id uuid not null references public.units(id),
  requested_by uuid not null references public.profiles(id),
  batch_version smallint not null,
  performed_at date not null,
  payload jsonb not null,
  result jsonb not null,
  applied_at timestamptz not null default now()
);

create index baseline_mount_batches_unit_applied_idx
  on public.baseline_mount_batches (unit_id, applied_at desc);
create index baseline_mount_batches_company_applied_idx
  on public.baseline_mount_batches (company_id, applied_at desc);
create index baseline_mount_batches_requested_by_idx
  on public.baseline_mount_batches (requested_by);

alter table public.baseline_mount_batches enable row level security;
create policy "select_own_company" on public.baseline_mount_batches
  for select to authenticated
  using (company_id = (select public.current_company_id()));
revoke all on table public.baseline_mount_batches from anon, authenticated;
grant select on table public.baseline_mount_batches to authenticated;

comment on table public.baseline_mount_batches is
  'Lotes idempotentes de primer montaje. origin=baseline registra una identidad confirmada por una persona desde una inspección; performed_at es una fecha declarada, no observada.';

create function public.confirm_baseline_mount(p_batch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_unit public.units%rowtype;
  v_batch_id uuid;
  v_unit_id uuid;
  v_performed_at date;
  v_odometer integer;
  v_mounts jsonb;
  v_existing jsonb;
  v_existing_company uuid;
  v_mount jsonb;
  v_seq integer;
  v_position smallint;
  v_measurement_id uuid;
  v_condition public.tire_condition;
  v_life_cycle_id uuid;
  v_installation_id uuid;
  v_created jsonb;
  v_result_map jsonb := '{}'::jsonb;
  v_result_mounts jsonb;
  v_result jsonb;
  v_constraint_name text;
begin
  if p_batch is null or jsonb_typeof(p_batch) <> 'object'
     or jsonb_typeof(p_batch->'batch_version') <> 'number'
     or p_batch->>'batch_version' <> '1'
     or jsonb_typeof(p_batch->'batch_id') <> 'string'
     or jsonb_typeof(p_batch->'unit_id') <> 'string'
     or jsonb_typeof(p_batch->'performed_at') <> 'string'
     or (p_batch ? 'odometer' and jsonb_typeof(p_batch->'odometer') not in ('number', 'null')) then
    raise exception '[lote_invalido] Encabezado de primer montaje inválido.' using errcode = '22023';
  end if;
  begin
    v_batch_id := (p_batch->>'batch_id')::uuid;
    v_unit_id := (p_batch->>'unit_id')::uuid;
    v_performed_at := (p_batch->>'performed_at')::date;
    v_odometer := nullif(p_batch->>'odometer', '')::integer;
  exception when data_exception then
    raise exception '[lote_invalido] Encabezado inválido: batch_id/unit_id deben ser UUID, performed_at fecha, odometer entero.' using errcode = '22023';
  end;
  if v_batch_id is null or v_unit_id is null or v_performed_at is null then
    raise exception '[lote_invalido] batch_id, unit_id y performed_at son obligatorios.' using errcode = '22023';
  end if;
  v_mounts := p_batch->'mounts';
  if jsonb_typeof(v_mounts) <> 'array' or jsonb_array_length(v_mounts) = 0 then
    raise exception '[lote_invalido] El lote no tiene mounts.' using errcode = '22023';
  end if;

  begin
    v_profile := public.fn_require_workshop_profile();
  exception when insufficient_privilege then
    raise exception '[sin_permiso] %', sqlerrm using errcode = '42501';
  end;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_batch_id::text, 0));
  select company_id, result into v_existing_company, v_existing
    from public.baseline_mount_batches where id = v_batch_id;
  if found then
    if v_existing_company <> v_profile.company_id then
      raise exception '[lote_invalido] El batch_id indicado no está disponible.' using errcode = '22023';
    end if;
    return jsonb_set(v_existing, '{already_applied}', 'true'::jsonb);
  end if;
  select u.* into v_unit from public.units u
   where u.id = v_unit_id and u.company_id = v_profile.company_id for update;
  if v_unit.id is null then
    raise exception '[sin_permiso] La unidad del lote no existe o no pertenece a tu empresa.' using errcode = '42501';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_mounts) m
     group by m->>'seq' having count(*) > 1
  ) or exists (
    select 1 from jsonb_array_elements(v_mounts) m
     group by m->>'position' having count(*) > 1
  ) then
    raise exception '[lote_invalido] seq y position deben ser únicos en el lote.' using errcode = '22023';
  end if;

  begin
    for v_mount in select value from jsonb_array_elements(v_mounts) order by (value->>'position')::smallint loop
      v_created := null;
      if jsonb_typeof(v_mount) <> 'object'
         or jsonb_typeof(v_mount->'seq') <> 'number'
         or jsonb_typeof(v_mount->'position') <> 'number'
         or jsonb_typeof(v_mount->'source_measurement_id') <> 'string'
         or jsonb_typeof(v_mount->'condition') <> 'string'
         or ((v_mount ? 'life_cycle_id') = (v_mount ? 'casing_code')) then
        raise exception '[lote_invalido] Cada mount requiere seq, position, source_measurement_id, condition y exactamente uno de life_cycle_id/casing_code.' using errcode = '22023';
      end if;
      v_seq := (v_mount->>'seq')::integer;
      v_position := (v_mount->>'position')::smallint;
      v_measurement_id := (v_mount->>'source_measurement_id')::uuid;
      v_condition := (v_mount->>'condition')::public.tire_condition;
      if v_condition <> 'N' and nullif(trim(coalesce(v_mount->>'retread_design', '')), '') is null then
        raise exception '[lote_invalido] condition % requiere retread_design.', v_condition using errcode = '22023';
      end if;
      if not exists (
        select 1 from public.inspection_measurements im join public.inspections i on i.id = im.inspection_id
         where im.id = v_measurement_id and i.unit_id = v_unit_id and im.position_number = v_position
      ) then
        raise exception '[evidencia_invalida] La medición fuente no pertenece a la unidad y posición indicadas.' using errcode = '22023';
      end if;
      if v_mount ? 'casing_code' then
        if nullif(trim(coalesce(v_mount->>'casing_code', '')), '') is null then
          raise exception '[lote_invalido] casing_code es obligatorio para crear un casco.' using errcode = '22023';
        end if;
        v_created := public.fn_create_casing_cycle_installation(
          v_profile, v_mount->>'casing_code', v_mount->>'brand_name', v_mount->>'model_name',
          v_mount->>'size_name', v_condition, v_mount->>'retread_design',
          nullif(v_mount->>'otd_mm', '')::numeric, null, 'PEN', v_unit_id, v_position,
          v_performed_at, v_odometer, nullif(v_mount->>'rtd_mm', '')::numeric,
          'baseline'::public.record_origin, v_measurement_id, v_mount->>'notes'
        );
        v_life_cycle_id := (v_created->>'life_cycle_id')::uuid;
        v_installation_id := (v_created->>'installation_id')::uuid;
      else
        v_life_cycle_id := (v_mount->>'life_cycle_id')::uuid;
        v_installation_id := public.fn_mount_existing_cycle(v_profile, v_life_cycle_id, v_unit_id,
          v_position, v_performed_at, v_odometer, nullif(v_mount->>'rtd_mm', '')::numeric, v_mount->>'notes');
        update public.tire_installations set origin = 'baseline', source_measurement_id = v_measurement_id
         where id = v_installation_id;
      end if;
      update public.inspection_measurements set life_cycle_id = v_life_cycle_id where id = v_measurement_id;
      v_result_map := v_result_map || jsonb_build_object(v_seq::text, jsonb_build_object(
        'seq', v_seq, 'position', v_position, 'casing_id',
        coalesce(v_created->>'casing_id', (select casing_id::text from public.tire_life_cycles where id = v_life_cycle_id)),
        'life_cycle_id', v_life_cycle_id, 'installation_id', v_installation_id));
    end loop;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint_name = constraint_name;
      if v_constraint_name = 'tire_installations_active_pos_uidx' then
        raise exception '[posicion_ocupada] Una posición de % ya tiene una instalación activa.', v_unit.plate using errcode = '23505';
      elsif v_constraint_name = 'tire_casings_company_code_uidx' then
        raise exception '[codigo_en_uso] El código ya existe en tu empresa. Buscalo y montá su ciclo existente con life_cycle_id.' using errcode = '23505';
      elsif v_constraint_name = 'tire_installations_active_cycle_uidx' then
        raise exception '[no_disponible] El ciclo ya está montado por otra operación.' using errcode = '22023';
      else raise;
      end if;
    when data_exception then
      -- Los helpers usan 22023 para errores de dominio ya normalizados
      -- ([no_disponible], [evidencia_invalida], etc.). No ocultarlos bajo un
      -- [lote_invalido] genérico; solo normalizar errores de casteo sin tag.
      if left(sqlerrm, 1) = '[' then
        raise;
      end if;
      raise exception '[lote_invalido] Tipos inválidos en un mount.' using errcode = '22023';
    when raise_exception then
      if sqlerrm like 'Ya existe un casco con el código%' then
        raise exception '[codigo_en_uso] El código ya existe en tu empresa. Buscalo y montá su ciclo existente con life_cycle_id.' using errcode = '23505';
      elsif sqlerrm like 'La posición P%ya está ocupada%' then
        raise exception '[posicion_ocupada] Una posición de % ya tiene una instalación activa.', v_unit.plate using errcode = '23505';
      else raise;
      end if;
  end;

  select jsonb_agg(v_result_map->(m->>'seq') order by (m->>'seq')::integer) into v_result_mounts
    from jsonb_array_elements(v_mounts) m;
  v_result := jsonb_build_object('batch_id', v_batch_id, 'applied', true, 'already_applied', false,
    'unit_id', v_unit_id, 'plate', v_unit.plate, 'mounts', v_result_mounts);
  insert into public.baseline_mount_batches (id, company_id, unit_id, requested_by, batch_version, performed_at, payload, result)
    values (v_batch_id, v_profile.company_id, v_unit_id, v_profile.id, 1, v_performed_at, p_batch, v_result);
  return v_result;
end;
$$;

revoke all on function public.confirm_baseline_mount(jsonb) from public, anon;
grant execute on function public.confirm_baseline_mount(jsonb) to authenticated;
comment on function public.confirm_baseline_mount(jsonb) is
  'Confirma uno o más primeros montajes desde evidencia de inspección. origin=baseline registra identidad confirmada por una persona; performed_at es declarada y el gate de cambios solo bloquea mount contradictorio.';

-- Conserva literalmente el cuerpo aplicado del lote y agrega una guarda antes
-- de delegarle. La firma pública y sus grants permanecen sin cambios.
alter function public.confirm_tire_change_batch(jsonb) rename to confirm_tire_change_batch_legacy;
revoke all on function public.confirm_tire_change_batch_legacy(jsonb) from public, anon, authenticated;

create function public.confirm_tire_change_batch(p_batch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_unit public.units%rowtype;
  v_batch_id uuid;
  v_unit_id uuid;
  v_mount jsonb;
  v_position smallint;
  v_life_cycle_id uuid;
  v_pending record;
begin
  if p_batch is null or jsonb_typeof(p_batch) <> 'object'
     or jsonb_typeof(p_batch->'unit_id') <> 'string'
     or jsonb_typeof(p_batch->'movements') <> 'array' then
    return public.confirm_tire_change_batch_legacy(p_batch);
  end if;
  begin v_unit_id := (p_batch->>'unit_id')::uuid; exception when data_exception then
    return public.confirm_tire_change_batch_legacy(p_batch);
  end;
  begin
    v_profile := public.fn_require_workshop_profile();
  exception when insufficient_privilege then
    raise exception '[sin_permiso] %', sqlerrm using errcode = '42501';
  end;
  -- La idempotencia del RPC original precede a toda revalidación del payload:
  -- un retry confirmado debe devolver su resultado aunque el cuerpo reenviado
  -- hoy describa una posición baseline_pending.
  if jsonb_typeof(p_batch->'batch_id') = 'string' then
    begin
      v_batch_id := (p_batch->>'batch_id')::uuid;
    exception when data_exception then
      v_batch_id := null;
    end;
    if v_batch_id is not null and exists (
      select 1 from public.tire_change_batches
       where id = v_batch_id and company_id = v_profile.company_id
    ) then
      return public.confirm_tire_change_batch_legacy(p_batch);
    end if;
  end if;
  select u.* into v_unit from public.units u where u.id = v_unit_id and u.company_id = v_profile.company_id for update;
  if v_unit.id is null then
    return public.confirm_tire_change_batch_legacy(p_batch);
  end if;
  for v_mount in select value from jsonb_array_elements(p_batch->'movements') where value->>'op' = 'mount' loop
    if jsonb_typeof(v_mount->'position') <> 'number' then continue; end if;
    begin v_position := (v_mount->>'position')::smallint; exception when data_exception then continue; end;
    -- No enmascarar los errores históricos del ciclo (UUID inválido, ciclo
    -- inexistente/descartado o ya montado). En esos casos el cuerpo original
    -- conserva [lote_invalido]/[no_disponible]; el gate solo precede a un
    -- montaje que de otro modo sería aplicable.
    begin
      v_life_cycle_id := (v_mount->>'life_cycle_id')::uuid;
    exception when data_exception then
      return public.confirm_tire_change_batch_legacy(p_batch);
    end;
    if not exists (
      select 1
        from public.tire_life_cycles lc
        join public.tire_casings c on c.id = lc.casing_id
       where lc.id = v_life_cycle_id
         and lc.company_id = v_profile.company_id
         and lc.status = 'active'
         and c.status = 'active'
         and not exists (
           select 1 from public.tire_installations ti
            where ti.life_cycle_id = lc.id and not ti.removed
         )
    ) then
      return public.confirm_tire_change_batch_legacy(p_batch);
    end if;
    select last_inspected_on, last_inspection_tire_code, last_rtd_movi_mm into v_pending
      from public.v_unit_position_state where unit_id = v_unit_id and position_number = v_position and baseline_pending;
    if found then
      raise exception '[linea_base_pendiente] La posición P% de % tiene un neumático conocido por la inspección del % (código %; RTD % mm) y todavía no tiene línea base. Registrá el primer montaje antes de montar otro neumático ahí.',
        v_position, v_unit.plate, v_pending.last_inspected_on,
        coalesce(nullif(v_pending.last_inspection_tire_code, ''), 'no legible'), v_pending.last_rtd_movi_mm using errcode = '22023';
    end if;
  end loop;
  return public.confirm_tire_change_batch_legacy(p_batch);
end;
$$;

revoke all on function public.confirm_tire_change_batch(jsonb) from public, anon;
grant execute on function public.confirm_tire_change_batch(jsonb) to authenticated;
comment on function public.confirm_tire_change_batch(jsonb) is
  'Aplica el lote vigente de cambios con una guarda adicional: solo mount sobre una posición con evidencia de inspección y sin instalación activa falla con [linea_base_pendiente].';
