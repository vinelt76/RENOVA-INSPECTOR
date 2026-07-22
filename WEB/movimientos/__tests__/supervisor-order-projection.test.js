import { describe, expect, it } from "vitest";

import { projectSupervisorOrder } from "../supervisor-order-projection.js";

const REMOTE = [
  { position_number: 1, is_empty: false, code_mismatch: false },
  { position_number: 2, is_empty: true, code_mismatch: false },
];

describe("proyección de orden", () => {
  it("marca salida y entrada sin modificar el estado remoto", () => {
    const draft = { items: [
      { direction: "exit", position: 1, reason: "repair" },
      { direction: "entry", position: 2 },
    ] };
    const projection = projectSupervisorOrder(REMOTE, draft, 1);

    expect(projection.get(1)).toMatchObject({ occupancy: "empty", role: "origin", label: "A REPARACIÓN" });
    expect(projection.get(2)).toMatchObject({ occupancy: "occupied", role: "destination", label: "INSTALAR" });
    expect(REMOTE).toEqual([
      { position_number: 1, is_empty: false, code_mismatch: false },
      { position_number: 2, is_empty: true, code_mismatch: false },
    ]);
  });
});
