import { filterRowsBySearchTokens, normalizeSearchText } from "../shared/search.js";

export const SEARCH_KINDS = Object.freeze(["unit", "casing", "inspection"]);
export const SEARCH_SCOPE_PREFIXES = Object.freeze({
  "uni:": "unit",
  "neu:": "casing",
  "med:": "inspection",
});
export const FRECENCY_HYSTERESIS = 2;
export const FRECENCY_MIN_SAMPLES = 2;

function compareText(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""), "es", { sensitivity: "base" });
}

/**
 * Interpreta únicamente un prefijo explícito al inicio. No infiere facetas ni
 * modifica el texto restante: D8 sigue vigente.
 */
export function parseSearchScope(query = "") {
  const raw = String(query ?? "");
  const match = raw.match(/^([^\s:]+:)([\s\S]*)$/);
  if (!match) return { kind: null, prefix: null, query: raw };
  const prefix = `${match[1].slice(0, -1).toLocaleLowerCase("es")}:`;
  const kind = SEARCH_SCOPE_PREFIXES[prefix] ?? null;
  if (!kind) return { kind: null, prefix: null, query: raw };
  return { kind, prefix, query: match[2].trimStart() };
}

export function rowsForSearchScope(rows, kind = null) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  return kind ? sourceRows.filter((row) => row?.kind === kind) : [...sourceRows];
}

function matchRank(row, normalizedQuery) {
  const label = normalizeSearchText(row?.label);
  const haystack = normalizeSearchText(row?.haystack);
  if (label.startsWith(normalizedQuery)) return 0;
  const paddedHaystack = ` ${haystack} `;
  if (paddedHaystack.includes(` ${normalizedQuery} `)) return 1;
  return 2;
}

function frecencyFor(frecency, entityId) {
  const value = frecency?.[entityId];
  if (typeof value === "number") return { score: value, samples: 1 };
  return {
    score: Number(value?.score) || 0,
    samples: Number(value?.samples) || 0,
  };
}

function sortWithinRank(entries, frecency, { pinnedFirstEntityId, hysteresis, minSamples }) {
  const base = [...entries].sort((left, right) => (
    compareText(left.row.kind, right.row.kind)
      || compareText(left.row.label, right.row.label)
      || left.index - right.index
  ));
  const pinned = pinnedFirstEntityId == null
    ? null
    : base.find((entry) => entry.row?.entity_id === pinnedFirstEntityId) ?? null;
  const movable = pinned ? base.filter((entry) => entry !== pinned) : base;

  movable.sort((left, right) => {
    const leftFrecency = frecencyFor(frecency, left.row?.entity_id);
    const rightFrecency = frecencyFor(frecency, right.row?.entity_id);
    const advantage = rightFrecency.score - leftFrecency.score;
    const sustained = rightFrecency.samples >= minSamples && advantage >= hysteresis;
    if (sustained) return 1;

    const reverseAdvantage = leftFrecency.score - rightFrecency.score;
    const reverseSustained = leftFrecency.samples >= minSamples && reverseAdvantage >= hysteresis;
    if (reverseSustained) return -1;
    return 0;
  });

  return pinned ? [pinned, ...movable] : movable;
}

/** Filtra y rankea sin mutar las filas fuente. */
export function searchIndexRows(rows, query = "", options = {}) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const matched = filterRowsBySearchTokens(sourceRows, query, ["haystack"]);
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return [...matched];

  const entries = matched.map((row, index) => ({
    row,
    index,
    rank: matchRank(row, normalizedQuery),
  }));
  const result = [];
  for (const rank of [0, 1, 2]) {
    const group = entries.filter((entry) => entry.rank === rank);
    result.push(...sortWithinRank(group, options.frecency, {
      pinnedFirstEntityId: options.pinnedFirstEntityId,
      hysteresis: options.hysteresis ?? FRECENCY_HYSTERESIS,
      minSamples: options.minSamples ?? FRECENCY_MIN_SAMPLES,
    }));
  }
  return result.map(({ row }) => row);
}

/** Agrupa cada resultado una sola vez y siempre expone ambos conteos. */
export function groupSearchResults(rows) {
  const groups = Object.fromEntries(SEARCH_KINDS.map((kind) => [kind, { kind, count: 0, rows: [] }]));
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!groups[row?.kind]) continue;
    groups[row.kind].rows.push(row);
    groups[row.kind].count += 1;
  }
  return groups;
}

/** Objetos recientes para el estado de consulta vacía; no crea ni elimina filas. */
export function recentSearchRows(rows, frecency = {}, limit = 8) {
  return [...(Array.isArray(rows) ? rows : [])]
    .map((row, index) => ({ row, index, frecency: frecencyFor(frecency, row?.entity_id) }))
    .sort((left, right) => (
      right.frecency.score - left.frecency.score
        || right.frecency.samples - left.frecency.samples
        || compareText(left.row?.kind, right.row?.kind)
        || compareText(left.row?.label, right.row?.label)
        || left.index - right.index
    ))
    .slice(0, Math.max(0, limit))
    .map(({ row }) => row);
}

/** Devuelve un registro nuevo de frecency; el llamador decide dónde persistirlo. */
export function recordSearchFrecency(frecency, entityId) {
  const current = frecencyFor(frecency, entityId);
  return {
    ...(frecency ?? {}),
    [entityId]: { score: current.score + 1, samples: current.samples + 1 },
  };
}

export function resolveSearchDestination(row) {
  if (row?.kind === "unit" && row.label != null) {
    return `Inspecciones por unidad.html?plate=${encodeURIComponent(row.label)}`;
  }
  if (row?.kind === "inspection" && row.inspection_id && row.unit_plate && row.position_number != null) {
    const params = new URLSearchParams({
      inspection_id: row.inspection_id,
      plate: row.unit_plate,
      pos: String(row.position_number),
    });
    return `Inspecciones por unidad.html?${params.toString()}`;
  }
  if (row?.kind !== "casing") return null;
  if (typeof row.casing_code === "string" && row.casing_code.trim()) {
    return `historial-neumatico.html?serie=${encodeURIComponent(row.casing_code)}&from=buscador`;
  }
  if (typeof row.unit_plate === "string" && row.unit_plate.trim()) {
    return `Inspecciones por unidad.html?plate=${encodeURIComponent(row.unit_plate)}`;
  }
  return null;
}
