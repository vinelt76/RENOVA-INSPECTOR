import { describe, it, expect } from "vitest";
import {
  createModeToggle,
  modeFromSearch,
  MOVIMIENTOS_MODES,
} from "../mode-toggle.js";

function modeFixture() {
  const element = () => ({
    hidden: false,
    tabIndex: 0,
    attributes: new Map(),
    classList: { toggle() {} },
    addEventListener() {},
    removeEventListener() {},
    setAttribute(name, value) { this.attributes.set(name, value); },
    focus() {},
  });
  const elements = new Map([
    ["tab-inspeccion", element()],
    ["tab-movimientos", element()],
    ["panel", element()],
    ["modo-movimientos", element()],
    ["pos-dock", element()],
    ["movimientos-pos-dock", element()],
    ["stage", element()],
  ]);
  return {
    documentObject: {
      documentElement: { dataset: {} },
      getElementById(id) { return elements.get(id) ?? null; },
    },
  };
}

// Smoke del runner (task_02): sólo confirma que vitest corre en este scope.
// Los tests reales de lógica los agregan task_04..task_08, task_13 y task_15.
describe("movimientos · runner smoke", () => {
  it("vitest está configurado y corre", () => {
    expect(1 + 1).toBe(2);
  });

  it("acepta el alias cambios y conserva el primer mode cuando viene repetido", () => {
    expect(modeFromSearch("?mode=cambios")).toBe(MOVIMIENTOS_MODES.MOVEMENTS);
    expect(modeFromSearch("?mode=cambios&mode=movimientos")).toBe(
      MOVIMIENTOS_MODES.MOVEMENTS,
    );
    expect(modeFromSearch("?mode=otro")).toBe(MOVIMIENTOS_MODES.INSPECTION);
  });

  it("canonicaliza el alias de URL a movimientos sin recargar", () => {
    const { documentObject } = modeFixture();
    const historyObject = { state: null, replaceState(...args) { this.args = args; } };
    const locationObject = {
      href: "https://renova.test/unidad?plate=QA-CN16&mode=cambios",
      search: "?plate=QA-CN16&mode=cambios",
    };

    const toggle = createModeToggle({ documentObject, locationObject, historyObject });

    expect(toggle.mode).toBe(MOVIMIENTOS_MODES.MOVEMENTS);
    expect(String(historyObject.args[2])).toBe(
      "https://renova.test/unidad?plate=QA-CN16&mode=movimientos",
    );
    toggle.destroy();
  });
});
