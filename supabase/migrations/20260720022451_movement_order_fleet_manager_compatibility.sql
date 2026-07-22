-- Compatibilidad para las cuentas web existentes.
--
-- Antes del rol dedicado `tire_supervisor`, los usuarios que dirigían la
-- operación web se provisionaron como `fleet_manager`. Ese rol ya estaba
-- autorizado para las RPCs transaccionales de taller; se incorpora también a
-- emisión/lectura de órdenes sin ampliar privilegios de `operator`.

drop policy if exists "select_movement_orders_own_company"
  on public.tire_movement_orders;
create policy "select_movement_orders_own_company"
  on public.tire_movement_orders for select to authenticated
  using (
    company_id = (select public.current_company_id())
    and (select public.current_profile_role()) in (
      'operator', 'tire_supervisor', 'fleet_manager', 'admin'
    )
  );

drop policy if exists "select_movement_executions_own_company"
  on public.tire_movement_executions;
create policy "select_movement_executions_own_company"
  on public.tire_movement_executions for select to authenticated
  using (
    company_id = (select public.current_company_id())
    and (select public.current_profile_role()) in (
      'operator', 'tire_supervisor', 'fleet_manager', 'admin'
    )
  );

create or replace function public.create_tire_movement_order(
  p_order_id       uuid,
  p_unit_id        uuid,
  p_scheduled_for  date,
  p_instructions   text,
  p_items          jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_unit public.units%rowtype;
  v_item jsonb;
  v_direction text;
  v_position smallint;
  v_reason text;
begin
  v_profile := public.fn_require_tire_movement_profile(
    array['tire_supervisor', 'fleet_manager', 'admin']
  );

  if p_order_id is null or p_unit_id is null then
    raise exception 'La orden y la unidad son obligatorias.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La orden necesita al menos un movimiento.' using errcode = '22023';
  end if;

  select * into v_unit
    from public.units
   where id = p_unit_id
     and company_id = v_profile.company_id
     and status <> 'inactive';
  if not found then
    raise exception 'La unidad no existe o no pertenece a tu empresa.' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_direction := v_item->>'direction';
    begin
      v_position := (v_item->>'position')::smallint;
    exception when others then
      raise exception 'Cada indicación necesita una posición válida.' using errcode = '22023';
    end;
    v_reason := nullif(btrim(v_item->>'reason'), '');

    if v_direction not in ('exit', 'entry') then
      raise exception 'La dirección debe ser exit o entry.' using errcode = '22023';
    end if;
    if v_position <= 0 or not exists (
      select 1 from public.tire_positions tp
       where tp.config_id = v_unit.config_id and tp.position_number = v_position
    ) then
      raise exception 'La posición P% no existe en la unidad %.', v_position, v_unit.plate
        using errcode = '22023';
    end if;
    if v_direction = 'exit' and v_reason not in (
      'repair', 'retention', 'claim', 'rotation', 'discard', 'retread', 'balancing'
    ) then
      raise exception 'La salida de P% necesita una razón válida.', v_position
        using errcode = '22023';
    end if;
  end loop;

  insert into public.tire_movement_orders (
    id, company_id, unit_id, requested_by, scheduled_for, instructions, request_items
  ) values (
    p_order_id, v_profile.company_id, p_unit_id, v_profile.id,
    coalesce(p_scheduled_for, current_date), nullif(btrim(p_instructions), ''), p_items
  );

  return jsonb_build_object(
    'order_id', p_order_id,
    'status', 'issued',
    'plate', v_unit.plate
  );
end;
$$;

revoke all on function public.create_tire_movement_order(uuid,uuid,date,text,jsonb)
  from public, anon;
grant execute on function public.create_tire_movement_order(uuid,uuid,date,text,jsonb)
  to authenticated;
