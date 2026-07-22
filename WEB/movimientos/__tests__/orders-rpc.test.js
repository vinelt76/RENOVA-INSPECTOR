import { describe, expect, it, vi } from "vitest";

import { createMovementOrder } from "../orders-rpc.js";

describe("RPC de órdenes", () => {
  it("llama únicamente create_tire_movement_order con el contrato del supervisor", async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: { status: "issued" }, error: null }) };
    const input = {
      orderId: "40000000-0000-4000-8000-000000000001",
      unitId: "10000000-0000-4000-8000-000000000001",
      scheduledFor: "2026-07-20",
      instructions: "Atender en turno mañana",
      items: [{ direction: "exit", position: 1, reason: "repair" }],
    };

    await expect(createMovementOrder(input, client)).resolves.toEqual({ status: "issued" });
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.rpc).toHaveBeenCalledWith("create_tire_movement_order", {
      p_order_id: input.orderId,
      p_unit_id: input.unitId,
      p_scheduled_for: input.scheduledFor,
      p_instructions: input.instructions,
      p_items: input.items,
    });
  });

  it("propaga el error de autorización", async () => {
    const error = { code: "42501", message: "rol no permitido" };
    const client = { rpc: vi.fn().mockResolvedValue({ data: null, error }) };
    await expect(createMovementOrder({ items: [] }, client)).rejects.toBe(error);
  });
});

