import { normalizeSearchText } from "./search.js";

/**
 * Contrato de faceta y chip: CONTRATOS_DATOS.md §1 (tasks_filtros_facetados).
 *   chip:  { facet, value, label? }
 *   facet: { key, label, type, values(rows), match(row, value) }
 */

/**
 * Reduce `rows` según `chips`, agrupados por faceta: OR dentro del grupo, AND
 * entre grupos (F8). Sin chips, o sin chips que resuelvan a una faceta
 * conocida, devuelve el conjunto completo. Puro: sin DOM, sin red, sin
 * `localStorage`, sin estado global.
 */
export function applyFilters(rows, chips, facets) {
  const source = Array.isArray(rows) ? rows : [];
  const chipList = Array.isArray(chips) ? chips : [];
  const facetByKey = new Map((Array.isArray(facets) ? facets : []).map((facet) => [facet.key, facet]));

  const groups = new Map();
  for (const chip of chipList) {
    if (!chip || !facetByKey.has(chip.facet)) continue; // faceta desconocida: se ignora, no lanza
    const values = groups.get(chip.facet) ?? [];
    values.push(chip.value);
    groups.set(chip.facet, values);
  }
  if (groups.size === 0) return [...source];

  return source.filter((row) =>
    [...groups.entries()].every(([facetKey, values]) => {
      const match = facetByKey.get(facetKey).match;
      return values.some((value) => match(row, value));
    })
  );
}

/**
 * Valores distintos de una columna presentes en `rows`, para poblar el
 * autocomplete (F7): nunca un catálogo declarado en código. Deduplica por
 * texto normalizado mostrando la primera grafía cruda vista; nulos y vacíos
 * no generan opción. Orden estable (localeCompare es, sensitivity base).
 *
 * `getValue` acepta un nombre de columna o un accesor `(row) => valor`.
 */
export function distinctValues(rows, getValue) {
  const source = Array.isArray(rows) ? rows : [];
  const accessor = typeof getValue === "function" ? getValue : (row) => row?.[getValue];

  const seen = new Map();
  for (const row of source) {
    const raw = accessor(row);
    const value = raw == null ? "" : String(raw).trim();
    if (!value) continue;
    const key = normalizeSearchText(value);
    if (!seen.has(key)) seen.set(key, value);
  }
  return [...seen.values()].sort((left, right) => left.localeCompare(right, "es", { sensitivity: "base" }));
}
