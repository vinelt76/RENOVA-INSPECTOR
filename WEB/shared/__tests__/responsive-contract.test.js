import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const shellCss = readFileSync(resolve(root, "renova-office-shell.css"), "utf8");
const movementCss = readFileSync(resolve(root, "movimientos/movimientos.css"), "utf8");
const unitHtml = readFileSync(resolve(root, "Inspecciones por unidad.html"), "utf8");

describe("contrato responsive de los dashboards", () => {
  it("mantiene una carcasa común sin desbordamiento horizontal", () => {
    expect(shellCss).toMatch(/\.office-head\s*\{[\s\S]*min-width:\s*0/);
    expect(shellCss).toMatch(/\.office-head--compact\s*\{[\s\S]*min-width:\s*0/);
    expect(shellCss).toMatch(/@media \(max-width:\s*1024px\)/);
  });

  it("recompone Servicios con la cabecera real de la vista de unidad", () => {
    expect(movementCss).toMatch(/html\[data-renova-mode="movimientos"\][\s\S]*?\.unit-tools/);
    expect(movementCss).toMatch(/@media \(max-width:\s*1024px\)/);
    expect(movementCss).toMatch(/\.stage\.movimientos-mode\s+\.unit-card/);
  });

  it("no depende de un lienzo mínimo para la vista de unidad", () => {
    expect(unitHtml).toMatch(/\.dash\s*\{[\s\S]*min-width:\s*0/);
    expect(unitHtml).not.toMatch(/window\.innerWidth\s*\/\s*1280/);
  });
});
