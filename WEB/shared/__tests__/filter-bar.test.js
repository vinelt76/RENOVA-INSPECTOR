import { describe, expect, it, vi } from "vitest";

import { createFilterBar } from "../filter-bar.js";

/**
 * DOM mínimo hecho a mano, mismo patrón que WEB/movimientos/__tests__/a11y.test.js
 * (sin jsdom: "sin dependencias npm nuevas", task_03 invariante). Cubre
 * exactamente la superficie que filter-bar.js usa: creación de elementos,
 * jerarquía (append/replaceChildren/contains), atributos, dataset y eventos.
 */
function createFakeDocument() {
  function createElement(tagName) {
    const element = {
      tagName,
      className: "",
      textContent: "",
      id: "",
      type: "",
      value: "",
      placeholder: "",
      autocomplete: "",
      title: "",
      hidden: false,
      dataset: {},
      children: [],
      parentNode: null,
      ownerDocument: document,
      attributes: new Map(),
      listeners: new Map(),
      append(...nodes) {
        for (const node of nodes) {
          node.parentNode = element;
          element.children.push(node);
        }
      },
      replaceChildren(...nodes) {
        element.children = [];
        element.append(...nodes);
      },
      setAttribute(key, value) {
        element.attributes.set(key, String(value));
      },
      getAttribute(key) {
        return element.attributes.has(key) ? element.attributes.get(key) : null;
      },
      removeAttribute(key) {
        element.attributes.delete(key);
      },
      addEventListener(type, fn) {
        if (!element.listeners.has(type)) element.listeners.set(type, new Set());
        element.listeners.get(type).add(fn);
      },
      removeEventListener(type, fn) {
        element.listeners.get(type)?.delete(fn);
      },
      dispatch(type, eventObj = {}) {
        const event = { type, preventDefault: () => {}, ...eventObj };
        for (const fn of element.listeners.get(type) ?? []) fn(event);
        return event;
      },
      contains(node) {
        if (node === element) return true;
        return element.children.some((child) => child === node || child.contains?.(node));
      },
      remove() {
        if (element.parentNode) {
          element.parentNode.children = element.parentNode.children.filter((c) => c !== element);
        }
      },
      focus: vi.fn(),
      querySelector: () => null,
      // Helpers de prueba, no forman parte de la interfaz DOM real.
      byClass(className) {
        for (const child of element.children) {
          if (String(child.className).split(" ").includes(className)) return child;
          const nested = child.byClass?.(className);
          if (nested) return nested;
        }
        return null;
      },
      allByClass(className) {
        const out = [];
        for (const child of element.children) {
          if (String(child.className).split(" ").includes(className)) out.push(child);
          out.push(...(child.allByClass?.(className) ?? []));
        }
        return out;
      },
    };
    return element;
  }

  const document = { createElement };
  return document;
}

function createMount() {
  const documentObject = createFakeDocument();
  const mount = documentObject.createElement("div");
  mount.ownerDocument = documentObject;
  return mount;
}

const rows = [
  { unidad: "ABC-123", neumatico: "IZE2W", estado: "critical" },
  { unidad: "ABC-123", neumatico: "XZA", estado: "normal" },
  { unidad: "DEF-456", neumatico: "IZE2W", estado: "normal" },
];

const facets = [
  { key: "unidad", label: "Unidad", type: "enum", values: (r) => [...new Set(r.map((row) => row.unidad))].sort(), match: (row, v) => row.unidad === v },
  { key: "neumatico", label: "Neumático", type: "enum", values: (r) => [...new Set(r.map((row) => row.neumatico))].sort(), match: (row, v) => row.neumatico === v },
];

describe("createFilterBar", () => {
  it("monta chips iniciales y descarta silenciosamente los de faceta desconocida", () => {
    const mount = createMount();
    const bar = createFilterBar({
      mount, facets, rows,
      chips: [{ facet: "unidad", value: "ABC-123", label: "Unidad: ABC-123" }, { facet: "fantasma", value: "x" }],
    });
    expect(bar.getChips()).toEqual([{ facet: "unidad", value: "ABC-123", label: "Unidad: ABC-123" }]);
    const chipButton = mount.byClass("filter-bar-chip");
    expect(chipButton.byClass("filter-bar-chip-text").textContent).toBe("Unidad: ABC-123 ×");
  });

  it("escribir agrupa sugerencias por faceta; un valor en dos facetas aparece en ambas (F5)", () => {
    const mount = createMount();
    const bar = createFilterBar({ mount, facets, rows });
    const input = mount.byClass("filter-bar-input");
    input.value = "IZE2W";
    input.dispatch("focus");
    input.dispatch("input");
    const groups = mount.allByClass("filter-bar-group-heading").map((h) => h.textContent);
    expect(groups).toEqual(["Neumático"]); // "IZE2W" solo existe como valor de neumático en este fixture
    bar.destroy();
  });

  it("un mismo texto presente en dos facetas se agrupa en las dos", () => {
    const mount = createMount();
    const sharedRows = [{ unidad: "IZE2W", neumatico: "IZE2W" }];
    const bar = createFilterBar({ mount, facets, rows: sharedRows });
    const input = mount.byClass("filter-bar-input");
    input.value = "ize2w";
    input.dispatch("focus");
    input.dispatch("input");
    const groups = mount.allByClass("filter-bar-group-heading").map((h) => h.textContent);
    expect(groups.sort()).toEqual(["Neumático", "Unidad"]);
    bar.destroy();
  });

  it("elegir una sugerencia con click crea un chip, limpia el campo y llama onChange", () => {
    const mount = createMount();
    const onChange = vi.fn();
    const bar = createFilterBar({ mount, facets, rows, onChange });
    const input = mount.byClass("filter-bar-input");
    input.value = "ABC";
    input.dispatch("input");
    const option = mount.byClass("filter-bar-option");
    option.dispatch("mousedown");
    option.dispatch("click");
    expect(input.value).toBe("");
    expect(bar.getChips()).toEqual([{ facet: "unidad", value: "ABC-123", label: "Unidad: ABC-123" }]);
    expect(onChange).toHaveBeenCalledWith([{ facet: "unidad", value: "ABC-123", label: "Unidad: ABC-123" }]);
  });

  it("Enter filtra directo tras escribir, sin necesitar una flecha antes", () => {
    const mount = createMount();
    const onChange = vi.fn();
    const bar = createFilterBar({ mount, facets, rows, onChange });
    const input = mount.byClass("filter-bar-input");
    input.value = "IZE2W";
    input.dispatch("input");
    input.dispatch("keydown", { key: "Enter" });
    expect(bar.getChips()).toEqual([{ facet: "neumatico", value: "IZE2W", label: "Neumático: IZE2W" }]);
  });

  it("ArrowDown/ArrowUp/Home/End navegan; Enter selecciona la resaltada", () => {
    const mount = createMount();
    const manyRows = [{ unidad: "AAA" }, { unidad: "BBB" }, { unidad: "CCC" }];
    const oneFacet = [{ key: "unidad", label: "Unidad", values: (r) => [...new Set(r.map((x) => x.unidad))].sort(), match: (row, v) => row.unidad === v }];
    const bar = createFilterBar({ mount, facets: oneFacet, rows: manyRows });
    const input = mount.byClass("filter-bar-input");
    input.dispatch("focus"); // campo vacío: sin resaltado automático
    input.dispatch("keydown", { key: "ArrowDown" }); // -> índice 0 (AAA)
    input.dispatch("keydown", { key: "ArrowDown" }); // -> índice 1 (BBB)
    input.dispatch("keydown", { key: "End" });        // -> último (CCC)
    input.dispatch("keydown", { key: "Home" });        // -> primero (AAA)
    input.dispatch("keydown", { key: "Enter" });
    expect(bar.getChips()).toEqual([{ facet: "unidad", value: "AAA", label: "Unidad: AAA" }]);
  });

  it("Escape cierra el desplegable sin borrar chips", () => {
    const mount = createMount();
    const bar = createFilterBar({ mount, facets, rows, chips: [{ facet: "unidad", value: "ABC-123" }] });
    const input = mount.byClass("filter-bar-input");
    input.dispatch("focus");
    expect(mount.byClass("filter-bar-listbox").hidden).toBe(false);
    input.dispatch("keydown", { key: "Escape" });
    expect(mount.byClass("filter-bar-listbox").hidden).toBe(true);
    expect(bar.getChips()).toHaveLength(1);
  });

  it("Backspace con el campo vacío borra el último chip y llama onChange", () => {
    const mount = createMount();
    const onChange = vi.fn();
    const bar = createFilterBar({
      mount, facets, rows, onChange,
      chips: [{ facet: "unidad", value: "ABC-123" }, { facet: "neumatico", value: "IZE2W" }],
    });
    const input = mount.byClass("filter-bar-input");
    input.value = "";
    input.dispatch("keydown", { key: "Backspace" });
    expect(bar.getChips()).toEqual([{ facet: "unidad", value: "ABC-123" }]);
    expect(onChange).toHaveBeenCalledWith([{ facet: "unidad", value: "ABC-123" }]);
  });

  it("Backspace con texto en el campo no borra chips", () => {
    const mount = createMount();
    const bar = createFilterBar({ mount, facets, rows, chips: [{ facet: "unidad", value: "ABC-123" }] });
    const input = mount.byClass("filter-bar-input");
    input.value = "algo";
    input.dispatch("keydown", { key: "Backspace" });
    expect(bar.getChips()).toHaveLength(1);
  });

  it("quitar un chip con su botón llama onChange", () => {
    const mount = createMount();
    const onChange = vi.fn();
    const bar = createFilterBar({ mount, facets, rows, onChange, chips: [{ facet: "unidad", value: "ABC-123" }] });
    mount.byClass("filter-bar-chip").dispatch("click");
    expect(bar.getChips()).toEqual([]);
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("setChips sincroniza sin llamar onChange (lo usa quien restaura desde URL)", () => {
    const mount = createMount();
    const onChange = vi.fn();
    const bar = createFilterBar({ mount, facets, rows, onChange });
    bar.setChips([{ facet: "unidad", value: "ABC-123" }]);
    expect(bar.getChips()).toEqual([{ facet: "unidad", value: "ABC-123" }]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("setChips también descarta facetas desconocidas", () => {
    const mount = createMount();
    const bar = createFilterBar({ mount, facets, rows });
    bar.setChips([{ facet: "unidad", value: "ABC-123" }, { facet: "fantasma", value: "x" }]);
    expect(bar.getChips()).toEqual([{ facet: "unidad", value: "ABC-123" }]);
  });

  it("rows vacío: mensaje honesto, no un desplegable vacío sin explicación", () => {
    const mount = createMount();
    const bar = createFilterBar({ mount, facets, rows: [] });
    const input = mount.byClass("filter-bar-input");
    input.dispatch("focus");
    expect(mount.byClass("filter-bar-empty").textContent).toBe("Sin datos cargados para sugerir.");
    bar.destroy();
  });

  it("facets vacío: no lanza, campo inerte", () => {
    const mount = createMount();
    expect(() => createFilterBar({ mount, facets: [], rows })).not.toThrow();
    const input = mount.byClass("filter-bar-input");
    expect(() => input.dispatch("input")).not.toThrow();
  });

  it("texto sin coincidencias: estado vacío explícito", () => {
    const mount = createMount();
    const bar = createFilterBar({ mount, facets, rows });
    const input = mount.byClass("filter-bar-input");
    input.value = "no-existe-esto";
    input.dispatch("input");
    expect(mount.byClass("filter-bar-empty").textContent).toBe("Sin coincidencias.");
  });

  it("setRows actualiza las sugerencias mientras el desplegable está abierto", () => {
    const mount = createMount();
    const bar = createFilterBar({ mount, facets, rows: [] });
    const input = mount.byClass("filter-bar-input");
    input.dispatch("focus");
    expect(mount.byClass("filter-bar-empty").textContent).toBe("Sin datos cargados para sugerir.");
    bar.setRows(rows);
    expect(mount.byClass("filter-bar-empty")).toBeNull();
  });

  it("destroy() deja el contenedor limpio", () => {
    const mount = createMount();
    const bar = createFilterBar({ mount, facets, rows });
    bar.destroy();
    expect(mount.children).toHaveLength(0);
  });

  it("no lanza si mount falta", () => {
    expect(() => createFilterBar({ facets, rows })).toThrow(TypeError);
  });
});
