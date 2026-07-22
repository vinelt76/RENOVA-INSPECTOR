const CREATE_ORDER_RPC = "create_tire_movement_order";

export async function createMovementOrder({ orderId, unitId, scheduledFor, instructions, items }, client) {
  if (!client?.rpc) throw new TypeError("El cliente Supabase no permite emitir órdenes.");
  const { data, error } = await client.rpc(CREATE_ORDER_RPC, {
    p_order_id: orderId,
    p_unit_id: unitId,
    p_scheduled_for: scheduledFor,
    p_instructions: String(instructions ?? "").trim() || null,
    p_items: items,
  });
  if (error) throw error;
  return data;
}

