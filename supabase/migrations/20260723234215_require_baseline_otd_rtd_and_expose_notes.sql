-- Completar una instalación desde inspecciones requiere las dos medidas que
-- hacen auditable el inicio del ciclo: OTD original y RTD al instalar.
-- La guarda vive en el RPC, no como NOT NULL global, para no invalidar
-- registros históricos anteriores que legítimamente quedaron incompletos.
alter function public.confirm_baseline_mount(jsonb)
  rename to confirm_baseline_mount_allow_nullable_measurements;

revoke all on function public.confirm_baseline_mount_allow_nullable_measurements(jsonb)
  from public, anon, authenticated;

create function public.confirm_baseline_mount(p_batch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_batch_id uuid;
  v_mount jsonb;
  v_life_cycle_id uuid;
  v_declared_otd numeric;
  v_cycle_otd numeric;
begin
  -- Un reintento de un lote ya aplicado conserva la idempotencia del RPC
  -- anterior, incluso si fue creado antes de que estas medidas fueran exigidas.
  begin
    v_batch_id := nullif(p_batch->>'batch_id', '')::uuid;
  exception when data_exception then
    v_batch_id := null;
  end;
  if v_batch_id is not null
     and exists (select 1 from public.baseline_mount_batches where id = v_batch_id) then
    return public.confirm_baseline_mount_allow_nullable_measurements(p_batch);
  end if;

  begin
    v_profile := public.fn_require_workshop_profile();
  exception when insufficient_privilege then
    raise exception '[sin_permiso] %', sqlerrm using errcode = '42501';
  end;

  if p_batch is null
     or jsonb_typeof(p_batch) <> 'object'
     or jsonb_typeof(p_batch->'mounts') <> 'array'
     or jsonb_array_length(p_batch->'mounts') = 0 then
    return public.confirm_baseline_mount_allow_nullable_measurements(p_batch);
  end if;

  for v_mount in select value from jsonb_array_elements(p_batch->'mounts') loop
    if jsonb_typeof(v_mount->'otd_mm') <> 'number'
       or (v_mount->>'otd_mm')::numeric <= 0 then
      raise exception '[lote_invalido] OTD original es obligatoria y debe ser mayor que cero en cada posición.'
        using errcode = '22023';
    end if;
    if jsonb_typeof(v_mount->'rtd_mm') <> 'number'
       or (v_mount->>'rtd_mm')::numeric <= 0 then
      raise exception '[lote_invalido] RTD al instalar es obligatorio y debe ser mayor que cero en cada posición.'
        using errcode = '22023';
    end if;

    -- Un ciclo recuperado del inventario conserva su OTD. Si ese dato histórico
    -- faltaba, esta confirmación lo completa; nunca sobrescribe una discrepancia.
    if v_mount ? 'life_cycle_id' then
      begin
        v_life_cycle_id := (v_mount->>'life_cycle_id')::uuid;
      exception when data_exception then
        raise exception '[lote_invalido] life_cycle_id debe ser UUID.'
          using errcode = '22023';
      end;
      v_declared_otd := (v_mount->>'otd_mm')::numeric;
      select lc.otd_mm
        into v_cycle_otd
        from public.tire_life_cycles lc
       where lc.id = v_life_cycle_id
         and lc.company_id = v_profile.company_id
       for update;
      if found then
        if v_cycle_otd is null then
          update public.tire_life_cycles
             set otd_mm = v_declared_otd
           where id = v_life_cycle_id;
        elsif abs(v_cycle_otd - v_declared_otd) > 0.05 then
          raise exception '[lote_invalido] La OTD declarada no coincide con la OTD del ciclo existente.'
            using errcode = '22023';
        end if;
      end if;
    end if;
  end loop;

  return public.confirm_baseline_mount_allow_nullable_measurements(p_batch);
end;
$$;

revoke all on function public.confirm_baseline_mount(jsonb) from public, anon;
grant execute on function public.confirm_baseline_mount(jsonb) to authenticated;
comment on function public.confirm_baseline_mount(jsonb) is
  'Confirma instalaciones regularizadas desde evidencia de inspección. Exige OTD original y RTD al instalar positivos; conserva idempotencia y valida la OTD de ciclos existentes.';

-- Las notas ya se guardaban en tire_installations.notes. Se exponen al final
-- de la trayectoria para que puedan consultarse en el historial del neumático.
create or replace view public.v_casing_installations
with (security_invoker = true) as
with installation_path as (
  select
    ti.id,
    ti.life_cycle_id,
    ti.notes as installation_notes,
    lead(ti.unit_id) over installation_order as next_unit_id,
    lead(ti.position_number) over installation_order as next_position_number
  from public.tire_installations ti
  window installation_order as (
    partition by ti.life_cycle_id
    order by ti.installed_at, ti.created_at, ti.id
  )
)
select
  cs.id as casing_id,
  cs.company_id,
  cs.code as casing_code,
  lc.cycle_number,
  lc.condition,
  k.installation_id,
  u.plate,
  k.position_number,
  k.installed_at,
  k.removed,
  k.removed_at,
  k.odometer_at_install,
  k.end_odometer,
  k.end_odometer_source,
  k.km_run,
  tr.reason::text as removal_reason,
  next_unit.plate as next_plate,
  path.next_position_number,
  path.installation_notes
from public.tire_casings cs
join public.tire_life_cycles lc
  on lc.casing_id = cs.id
join public.v_installation_km k
  on k.life_cycle_id = lc.id
join public.units u
  on u.id = k.unit_id
join installation_path path
  on path.id = k.installation_id
left join public.tire_removals tr
  on tr.installation_id = k.installation_id
left join public.units next_unit
  on next_unit.id = path.next_unit_id;

grant select on public.v_casing_installations to authenticated;
