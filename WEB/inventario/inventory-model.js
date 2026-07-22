import { filterRowsBySearchTokens, normalizeSearchText } from "../shared/search.js";

export const INVENTORY_TABS = Object.freeze({
  RETENTION: "reten",
  DISCARDED: "descartados",
});

const SEARCHABLE_COLUMNS = [
  "casing_code",
  "code",
  "brand_name",
  "model_name",
  "size_name",
  "condition",
  "retread_design",
  "last_removal_reason",
  "last_removal_discard_cause",
  "last_unit_plate",
];

export { normalizeSearchText };

/**
 * Aplica una búsqueda tokenizada: cada palabra puede coincidir en una columna
 * diferente. El orden original y las filas de entrada no se modifican.
 */
export function filterInventoryRows(rows, query) {
  return filterRowsBySearchTokens(rows, query, SEARCHABLE_COLUMNS);
}

export function inventoryCounts(data = {}) {
  return {
    [INVENTORY_TABS.RETENTION]: Array.isArray(data.retention) ? data.retention.length : 0,
    [INVENTORY_TABS.DISCARDED]: Array.isArray(data.discarded) ? data.discarded.length : 0,
  };
}

/** Selecciona y filtra una pestaña; valores desconocidos vuelven a Retén. */
export function inventoryRowsForTab(data = {}, tab, query = "") {
  const rows = tab === INVENTORY_TABS.DISCARDED ? data.discarded : data.retention;
  return filterInventoryRows(rows, query);
}
