-- Permite al supervisor corregir una orden emitida por error sin borrar la
-- trazabilidad de la operación. Solo puede cancelar sus propias órdenes que
-- aún no han sido tomadas por un operario.

create or replace function public.cancel_tire_movement_order(
  p_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_order public.tire_movement_orders;
begin
  v_profile := public.fn_require_tire_movement_profile(
    array['tire_supervisor']
  );

  select * into v_order
    from public.tire_movement_orders
   where id = p_order_id
     and company_id = v_profile.company_id
     and requested_by = v_profile.id
   for update;

  if v_order.id is null then
    raise exception 'La orden no existe o no fue emitida por tu usuario.'
      using errcode = '42501';
  end if;

  if v_order.status <> 'issued' then
    raise exception 'Solo puedes eliminar una orden que todavía está en cola.'
      using errcode = '55000';
  end if;

  update public.tire_movement_orders
     set status = 'cancelled'
   where id = v_order.id;

  return jsonb_build_object('order_id', v_order.id, 'status', 'cancelled');
end;
$$;

revoke all on function public.cancel_tire_movement_order(uuid)
  from public, anon, authenticated;
grant execute on function public.cancel_tire_movement_order(uuid) to authenticated;
