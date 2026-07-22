-- RENOVA — Órdenes y captura de movimientos por operarios.
--
-- Responsabilidades separadas:
--   inspector       -> registra inspecciones (app RENOVA Inspector existente)
--   tire_supervisor -> emite y dirige órdenes de movimiento
--   operator        -> ejecuta la orden y captura la hoja de salida/ingreso
--
-- Esta capa conserva el hecho operativo aunque la empresa todavía no haya
-- importado su línea base de instalaciones. No inventa cierres ni instalaciones
-- canónicas: cada renglón queda pending hasta que el reconciliador pueda ligarlo
-- con tire_casings/tire_life_cycles/tire_installations.

alter type public.user_role add value if not exists 'tire_supervisor';
alter type public.user_role add value if not exists 'operator';

create type public.tire_movement_order_status as enum (
  'issued', 'in_progress', 'completed', 'cancelled'
);

create type public.tire_movement_direction as enum ('exit', 'entry');

create type public.tire_movement_reason as enum (
  'repair',
  'retention',
  'claim',
  'rotation',
  'discard',
  'retread',
  'balancing'
);

create type public.tire_movement_reconciliation_status as enum (
  'pending', 'reconciled', 'needs_review'
);

create table public.tire_movement_orders (
  id              uuid primary key,
  company_id      uuid not null references public.companies(id),
  unit_id         uuid not null references public.units(id),
  requested_by    uuid not null references public.profiles(id),
  assigned_to     uuid references public.profiles(id),
  status          public.tire_movement_order_status not null default 'issued',
  scheduled_for   date not null default current_date,
  instructions    text,
  request_items   jsonb not null default '[]'::jsonb,
  issued_at       timestamptz not null default now(),
  started_at      timestamptz,
  completed_at    timestamptz,
  odometer_km     integer,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint tire_movement_orders_odometer_nonnegative
    check (odometer_km is null or odometer_km >= 0),
  constraint tire_movement_orders_request_items_array
    check (jsonb_typeof(request_items) = 'array')
);

comment on table public.tire_movement_orders is
  'Orden emitida por un supervisor de neumáticos y ejecutada por un operario. La empresa siempre se deriva del perfil autenticado.';
comment on column public.tire_movement_orders.request_items is
  'Indicaciones breves del supervisor: direction, position, reason y notes. No contiene la captura técnica final del operario.';
comment on column public.tire_movement_orders.odometer_km is
  'Lectura de la máquina capturada una vez al ejecutar. Se aplica a todas las salidas/entradas de la orden.';

create table public.tire_movement_executions (
  id                    uuid primary key,
  order_id              uuid not null references public.tire_movement_orders(id),
  company_id            uuid not null references public.companies(id),
  sequence              smallint not null,
  direction             public.tire_movement_direction not null,
  position_number       smallint not null,
  movement_reason       public.tire_movement_reason,
  casing_code           text,
  code_unreadable       boolean not null default false,
  brand_name            text,
  size_name             text,
  design_name           text,
  rtd_min_mm            numeric(5,2),
  condition             public.tire_condition not null,
  retread_design        text,
  observations          text,
  captured_by           uuid not null references public.profiles(id),
  captured_at           timestamptz not null default now(),
  reconciliation_status public.tire_movement_reconciliation_status not null default 'pending',
  reconciled_at         timestamptz,
  reconciliation_notes  text,
  unique (order_id, sequence),
  constraint tire_movement_executions_position_positive check (position_number > 0),
  constraint tire_movement_executions_rtd_nonnegative check (rtd_min_mm is null or rtd_min_mm >= 0),
  constraint tire_movement_executions_identity check (
    code_unreadable or nullif(btrim(casing_code), '') is not null
  ),
  constraint tire_movement_executions_reason_by_direction check (
    (direction = 'exit' and movement_reason is not null)
    or (direction = 'entry' and movement_reason is null)
  ),
  constraint tire_movement_executions_retread_design check (
    condition = 'N' or nullif(btrim(retread_design), '') is not null
  )
);

comment on table public.tire_movement_executions is
  'Renglones digitales de Salida/Ingreso capturados por el operario. Permanecen auditables aunque aún no exista una línea base canónica para reconciliarlos.';
comment on column public.tire_movement_executions.movement_reason is
  'Razón declarada por una persona. claim es un tag operativo y no se infiere por kilometraje o RTD.';

create index tire_movement_orders_company_status_idx
  on public.tire_movement_orders (company_id, status, scheduled_for, issued_at desc);
create index tire_movement_orders_assigned_idx
  on public.tire_movement_orders (assigned_to, status, scheduled_for);
create index tire_movement_orders_requested_by_idx
  on public.tire_movement_orders (requested_by);
create index tire_movement_orders_unit_idx
  on public.tire_movement_orders (unit_id, issued_at desc);
create index tire_movement_executions_company_pending_idx
  on public.tire_movement_executions (company_id, reconciliation_status, captured_at);
create index tire_movement_executions_order_idx
  on public.tire_movement_executions (order_id, sequence);
create index tire_movement_executions_captured_by_idx
  on public.tire_movement_executions (captured_by);

alter table public.tire_movement_orders enable row level security;
alter table public.tire_movement_executions enable row level security;

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role::text from public.profiles where id = auth.uid() and active;
$$;

revoke all on function public.current_profile_role() from public, anon;
grant execute on function public.current_profile_role() to authenticated;

create policy "select_movement_orders_own_company"
  on public.tire_movement_orders for select to authenticated
  using (
    company_id = (select public.current_company_id())
    and (select public.current_profile_role()) in ('operator', 'tire_supervisor', 'admin')
  );

create policy "select_movement_executions_own_company"
  on public.tire_movement_executions for select to authenticated
  using (
    company_id = (select public.current_company_id())
    and (select public.current_profile_role()) in ('operator', 'tire_supervisor', 'admin')
  );

revoke all on table public.tire_movement_orders from public, anon, authenticated;
revoke all on table public.tire_movement_executions from public, anon, authenticated;
grant select on table public.tire_movement_orders to authenticated;
grant select on table public.tire_movement_executions to authenticated;

create or replace function public.fn_require_tire_movement_profile(
  p_allowed_roles text[]
)
returns public.profiles
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Necesitás iniciar sesión para trabajar con movimientos.'
      using errcode = '42501';
  end if;

  select * into v_profile
    from public.profiles
   where id = auth.uid();

  if v_profile.id is null or not v_profile.active then
    raise exception 'Tu usuario no tiene un perfil activo en RENOVA.'
      using errcode = '42501';
  end if;

  if not (v_profile.role::text = any(p_allowed_roles)) then
    raise exception 'Tu rol (%) no permite realizar esta acción.', v_profile.role
      using errcode = '42501';
  end if;

  return v_profile;
end;
$$;

revoke all on function public.fn_require_tire_movement_profile(text[])
  from public, anon, authenticated;

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
    array['tire_supervisor', 'admin']
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

create or replace function public.claim_tire_movement_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_order public.tire_movement_orders%rowtype;
begin
  v_profile := public.fn_require_tire_movement_profile(array['operator']);

  select * into v_order
    from public.tire_movement_orders
   where id = p_order_id
     and company_id = v_profile.company_id
   for update;

  if not found then
    raise exception 'La orden no existe o no pertenece a tu empresa.' using errcode = '22023';
  end if;
  if v_order.status = 'completed' then
    return jsonb_build_object('order_id', v_order.id, 'status', v_order.status, 'already_completed', true);
  end if;
  if v_order.status = 'cancelled' then
    raise exception 'La orden fue cancelada.' using errcode = '22023';
  end if;
  if v_order.assigned_to is not null and v_order.assigned_to <> v_profile.id then
    raise exception 'Otro operario ya tomó esta orden.' using errcode = '40001';
  end if;

  update public.tire_movement_orders
     set assigned_to = v_profile.id,
         status = 'in_progress',
         started_at = coalesce(started_at, now()),
         updated_at = now()
   where id = v_order.id;

  return jsonb_build_object('order_id', v_order.id, 'status', 'in_progress');
end;
$$;

revoke all on function public.claim_tire_movement_order(uuid) from public, anon;
grant execute on function public.claim_tire_movement_order(uuid) to authenticated;

create or replace function public.complete_tire_movement_order(
  p_order_id    uuid,
  p_odometer_km integer,
  p_items       jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_order public.tire_movement_orders%rowtype;
  v_unit public.units%rowtype;
  v_item jsonb;
  v_direction public.tire_movement_direction;
  v_reason public.tire_movement_reason;
  v_condition public.tire_condition;
  v_position smallint;
  v_sequence smallint := 0;
  v_code text;
  v_unreadable boolean;
  v_retread_design text;
begin
  v_profile := public.fn_require_tire_movement_profile(array['operator']);

  select * into v_order
    from public.tire_movement_orders
   where id = p_order_id
     and company_id = v_profile.company_id
   for update;
  if not found then
    raise exception 'La orden no existe o no pertenece a tu empresa.' using errcode = '22023';
  end if;
  if v_order.status = 'completed' then
    return jsonb_build_object('order_id', v_order.id, 'status', v_order.status, 'already_completed', true);
  end if;
  if v_order.status <> 'in_progress' or v_order.assigned_to is distinct from v_profile.id then
    raise exception 'Primero debés tomar esta orden.' using errcode = '42501';
  end if;

  select * into v_unit
    from public.units
   where id = v_order.unit_id
     and company_id = v_profile.company_id
   for update;

  if p_odometer_km is null or p_odometer_km < 0 then
    raise exception 'El kilometraje de la máquina es obligatorio.' using errcode = '22023';
  end if;
  if v_unit.last_odometer is not null and p_odometer_km < v_unit.last_odometer then
    raise exception 'El kilometraje (%) no puede ser menor al último conocido (%).',
      p_odometer_km, v_unit.last_odometer using errcode = '22023';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La ejecución necesita al menos un neumático.' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_sequence := v_sequence + 1;
    begin
      v_direction := (v_item->>'direction')::public.tire_movement_direction;
      v_position := (v_item->>'position')::smallint;
      v_condition := (v_item->>'condition')::public.tire_condition;
      v_reason := case when v_direction = 'exit'
        then (v_item->>'reason')::public.tire_movement_reason else null end;
    exception when others then
      raise exception 'Datos inválidos en el renglón %.', v_sequence using errcode = '22023';
    end;

    if not exists (
      select 1 from public.tire_positions tp
       where tp.config_id = v_unit.config_id and tp.position_number = v_position
    ) then
      raise exception 'La posición P% no existe en la unidad %.', v_position, v_unit.plate
        using errcode = '22023';
    end if;

    v_code := nullif(btrim(v_item->>'code'), '');
    v_unreadable := coalesce((v_item->>'code_unreadable')::boolean, false);
    if v_code is null and not v_unreadable then
      raise exception 'El renglón % necesita código o marcar "sin código legible".', v_sequence
        using errcode = '22023';
    end if;

    v_retread_design := nullif(btrim(v_item->>'retread_design'), '');
    if v_condition <> 'N' and v_retread_design is null then
      raise exception 'El renglón % necesita diseño de reencauche para %.', v_sequence, v_condition
        using errcode = '22023';
    end if;

    insert into public.tire_movement_executions (
      id, order_id, company_id, sequence, direction, position_number,
      movement_reason, casing_code, code_unreadable, brand_name, size_name,
      design_name, rtd_min_mm, condition, retread_design, observations, captured_by
    ) values (
      coalesce(nullif(v_item->>'id', '')::uuid, gen_random_uuid()),
      v_order.id, v_profile.company_id, v_sequence, v_direction, v_position,
      v_reason, v_code, v_unreadable,
      nullif(btrim(v_item->>'brand'), ''),
      nullif(btrim(v_item->>'size'), ''),
      nullif(btrim(v_item->>'design'), ''),
      nullif(v_item->>'rtd_min_mm', '')::numeric,
      v_condition, v_retread_design,
      nullif(btrim(v_item->>'observations'), ''), v_profile.id
    );
  end loop;

  update public.tire_movement_orders
     set status = 'completed', odometer_km = p_odometer_km,
         completed_at = now(), updated_at = now()
   where id = v_order.id;

  update public.units
     set last_odometer = greatest(coalesce(last_odometer, 0), p_odometer_km),
         updated_at = now()
   where id = v_unit.id;

  return jsonb_build_object(
    'order_id', v_order.id,
    'status', 'completed',
    'captured_items', v_sequence,
    'reconciliation_status', 'pending'
  );
end;
$$;

revoke all on function public.complete_tire_movement_order(uuid,integer,jsonb)
  from public, anon;
grant execute on function public.complete_tire_movement_order(uuid,integer,jsonb)
  to authenticated;

create view public.v_operator_movement_orders
with (security_invoker = true)
as
select
  o.id,
  o.company_id,
  c.name as company_name,
  o.unit_id,
  u.plate,
  u.last_odometer,
  vc.notation as vehicle_config,
  o.requested_by,
  requester.full_name as requested_by_name,
  o.assigned_to,
  assignee.full_name as assigned_to_name,
  o.status,
  o.scheduled_for,
  o.instructions,
  o.request_items,
  o.issued_at,
  o.started_at,
  o.completed_at,
  o.odometer_km,
  coalesce(jsonb_array_length(o.request_items), 0) as requested_items_count
from public.tire_movement_orders o
join public.companies c on c.id = o.company_id
join public.units u on u.id = o.unit_id
join public.vehicle_configs vc on vc.id = u.config_id
join public.profiles requester on requester.id = o.requested_by
left join public.profiles assignee on assignee.id = o.assigned_to;

comment on view public.v_operator_movement_orders is
  'Bandeja de órdenes para la app de operarios. security_invoker conserva RLS por empresa.';

revoke all on public.v_operator_movement_orders from public, anon, authenticated;
grant select on public.v_operator_movement_orders to authenticated;
