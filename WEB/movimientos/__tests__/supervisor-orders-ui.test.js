import { describe, expect, it } from "vitest";

import { movementActionHelp } from "../supervisor-orders-ui.js";

describe("ayuda de acciones de movimientos", () => {
  it("permite servicios aunque la posición tenga línea base pendiente", () => {
    expect(movementActionHelp({ is_empty: true, baseline_pending: true })).toBe(
      "Esta posición no tiene instalación registrada. Puedes emitir un servicio igualmente; la captura del operario quedará pendiente de reconciliación.",
    );
  });
});
