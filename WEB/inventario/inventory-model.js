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

/** Normaliza texto para búsquedas tolerantes a mayúsculas, espacios y acentos. */
export function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es")
    .trim()
    .replace(/\s+/g, " ");
}

function searchableText(row) {
  return normalizeSearchText(SEARCHABLE_COLUMNS.map((column) => row?.[column]).join(" "));
}

/**
 * Aplica una búsqueda tokenizada: cada palabra puede coincidir en una columna
 * diferente. El orden original y las filas de entrada no se modifican.
 */
export function filterInventoryRows(rows, query) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const tokens = normalizeSearchText(query).split(" ").filter(Boolean);
  if (tokens.length === 0) return [...safeRows];

  return safeRows.filter((row) => {
    const haystack = searchableText(row);
    return tokens.every((token) => haystack.includes(token));
  });
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
