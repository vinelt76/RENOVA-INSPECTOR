import { filterRowsBySearchTokens, normalizeSearchText } from "../shared/search.js";

export const TIRE_FACETS = Object.freeze([
  { param: "marca", column: "brand_name", label: "Marca" },
  { param: "modelo", column: "model_name", label: "Modelo" },
  { param: "medida", column: "size_name", label: "Medida" },
  { param: "condicion", column: "condition", label: "Condición" },
  { param: "reencauche", column: "retread_design", label: "Reencauche" },
  { param: "estado", column: "status", label: "Estado" },
]);

const FACET_BY_PARAM = new Map(TIRE_FACETS.map((facet) => [facet.param, facet]));
const SEARCHABLE_COLUMNS = ["label", "sublabel", "haystack", "casing_code", "unit_plate"];

function textValue(value) {
  return String(value ?? "").trim();
}

export function tireFacetFromSearch(search = "") {
  const params = new URLSearchParams(search);
  const facets = {};
  for (const facet of TIRE_FACETS) {
    const value = textValue(params.get(facet.param));
    if (value) facets[facet.param] = value;
  }
  return facets;
}

export function tireFacetSearch(facets = {}) {
  const params = new URLSearchParams();
  for (const facet of TIRE_FACETS) {
    const value = textValue(facets[facet.param]);
    if (value) params.set(facet.param, value);
  }
  return params.toString();
}

export function isTireRow(row) {
  return row?.kind === "casing";
}

/** AND explícito de facetas; la comparación absorbe caja/diacríticos, no limpia la fuente. */
export function filterTireFacetRows(rows, facets = {}) {
  const source = Array.isArray(rows) ? rows : [];
  return source.filter((row) => isTireRow(row) && TIRE_FACETS.every((facet) => {
    const requested = textValue(facets[facet.param]);
    if (!requested) return true;
    return normalizeSearchText(row?.[facet.column]) === normalizeSearchText(requested);
  }));
}

export function filterTireRows(rows, { facets = {}, query = "" } = {}) {
  return filterRowsBySearchTokens(filterTireFacetRows(rows, facets), query, SEARCHABLE_COLUMNS);
}

/** Valores de UI obtenidos del índice, nunca de un catálogo declarado en código. */
export function availableTireFacetValues(rows, facets = {}) {
  const values = {};
  for (const facet of TIRE_FACETS) {
    const otherFacets = { ...facets };
    delete otherFacets[facet.param];
    const seen = new Map();
    for (const row of filterTireFacetRows(rows, otherFacets)) {
      const value = textValue(row?.[facet.column]);
      const normalized = normalizeSearchText(value);
      if (value && !seen.has(normalized)) seen.set(normalized, value);
    }
    values[facet.param] = [...seen.values()].sort((left, right) => left.localeCompare(right, "es", { sensitivity: "base" }));
  }
  return values;
}

export function facetLabel(param) {
  return FACET_BY_PARAM.get(param)?.label ?? param;
}

export function facetColumn(param) {
  return FACET_BY_PARAM.get(param)?.column ?? null;
}

export function casingHistoryHref(row) {
  const code = textValue(row?.casing_code);
  return code ? `historial-neumatico.html?serie=${encodeURIComponent(code)}&from=neumaticos` : null;
}
