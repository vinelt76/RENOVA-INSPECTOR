import { describe, expect, it } from "vitest";

import {
  captureOrderActionState,
  movementActionHelp,
  restoreOrderActionState,
} from "../supervisor-orders-ui.js";

describe("ayuda de acciones de movimientos", () => {
  it("permite servicios aunque la posición tenga línea base pendiente", () => {
    expect(movementActionHelp({ is_empty: true, baseline_pending: true })).toBe(
      "Esta posición no tiene instalación registrada. Puedes emitir un servicio igualmente; la captura del operario quedará pendiente de reconciliación.",
    );
  });
});

describe("estado del editor de acciones", () => {
  it("conserva los controles mientras se refrescan las órdenes", () => {
    const fields = new Map([
      ["[data-order-reason]", { value: "repair" }],
      ["[data-order-target]", { value: "3" }],
      ["[data-order-notes]", { value: "antes del turno" }],
      ["[data-order-inventory-search]", { value: "MICHELIN" }],
    ]);
    const source = { querySelector: (selector) => fields.get(selector) };

    const saved = captureOrderActionState(source);
    for (const field of fields.values()) field.value = "";
    restoreOrderActionState(source, saved);

    expect(saved).toEqual({
      reason: "repair",
      target: "3",
      notes: "antes del turno",
      inventorySearch: "MICHELIN",
    });
    expect([...fields.values()].map(({ value }) => value)).toEqual([
      "repair",
      "3",
      "antes del turno",
      "MICHELIN",
    ]);
  });
});
