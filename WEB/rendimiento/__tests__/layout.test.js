import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HTML_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../rendimiento.html");

function cssRule(html, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.match(new RegExp(`${escaped}\\{([^}]*)\\}`))?.[1] ?? "";
}

describe("Rendimiento — layout de tarjetas ejecutivas", () => {
  it("mantiene la cobertura de costo debajo del texto sin forzar una columna que se desborde", () => {
    const html = readFileSync(HTML_PATH, "utf8");
    const costRule = cssRule(html, ".fleet-vur,.fleet-cost");
    const costOverride = cssRule(html, ".fleet-cost");

    expect(costRule).toContain("grid-template-columns:minmax(0,1fr)");
    expect(costOverride).toContain("grid-template-columns:minmax(0,1fr)");
  });
});
