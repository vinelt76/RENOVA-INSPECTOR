import { describe, expect, it } from "vitest";

import {
  addOrderItem,
  addRotation,
  createOrderDraft,
  createOrderId,
  orderRpcPayload,
  SUPERVISOR_ORDER_ROLES,
  validateOrderDraft,
} from "../supervisor-order-model.js";

const POSITIONS = [1, 2, 3, 4, 5, 6];

describe("orden del supervisor", () => {
  it("usa randomUUID cuando el navegador lo expone", () => {
    const expected = "40000000-0000-4000-8000-000000000001";
    expect(createOrderId({ randomUUID: () => expected })).toBe(expected);
  });

  it("genera un UUID v4 con getRandomValues en navegadores sin randomUUID", () => {
    const cryptoApi = {
      getRandomValues(bytes) {
        bytes.fill(0);
        return bytes;
      },
    };
    const orderId = createOrderId(cryptoApi);

    expect(orderId).toBe("00000000-0000-4000-8000-000000000000");
    expect(orderId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("falla claramente si Web Crypto no existe", () => {
    expect(() => createOrderId(null)).toThrow("generación aleatoria compatible");
  });

  it("acepta el rol web histórico sin habilitar al operario", () => {
    expect(SUPERVISOR_ORDER_ROLES).toContain("fleet_manager");
    expect(SUPERVISOR_ORDER_ROLES).toContain("tire_supervisor");
    expect(SUPERVISOR_ORDER_ROLES).not.toContain("operator");
  });

  it("solo envía indicaciones operativas, sin datos técnicos del neumático", () => {
    const result = addOrderItem(
      createOrderDraft({ scheduledFor: "2026-07-20" }),
      { direction: "exit", position: 2, reason: "claim", notes: "Neumático nuevo" },
      POSITIONS,
    );

    expect(result.ok).toBe(true);
    expect(orderRpcPayload(result.draft)).toEqual([{
      direction: "exit",
      position: 2,
      reason: "claim",
      notes: "Neumático nuevo",
    }]);
    expect(orderRpcPayload(result.draft)[0]).not.toHaveProperty("casing_code");
    expect(orderRpcPayload(result.draft)[0]).not.toHaveProperty("odometer_km");
  });

  it("convierte rotación en salida declarada y entrada para el operario", () => {
    const result = addRotation(
      createOrderDraft({ scheduledFor: "2026-07-20" }),
      3,
      5,
      "intercambiar gemelos",
      POSITIONS,
    );

    expect(result.ok).toBe(true);
    expect(result.draft.items).toEqual([
      { direction: "exit", position: 3, reason: "rotation", notes: "intercambiar gemelos" },
      { direction: "entry", position: 5, notes: "Rotar desde P3 · intercambiar gemelos" },
    ]);
  });

  it("rechaza duplicados, salidas sin razón y posiciones no configuradas", () => {
    const draft = createOrderDraft({
      scheduledFor: "2026-07-20",
      items: [
        { direction: "exit", position: 1, reason: "repair" },
        { direction: "exit", position: 1, reason: "discard" },
        { direction: "entry", position: 8 },
      ],
    });

    expect(validateOrderDraft(draft, POSITIONS)).toEqual(expect.arrayContaining([
      "P1: la salida está repetida.",
      "Indicación 3: posición inválida.",
    ]));
  });
});
