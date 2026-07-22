import { MOVEMENT_REASONS } from "../movimientos/supervisor-order-model.js";
import { applyFilters, distinctValues } from "../shared/filter-facets.js";
import {
  distinctInspectionExactDateValues,
  distinctInspectionMonthValues,
  matchInspectionDateFacet,
  matchInspectionMonthFacet,
} from "../shared/inspection-date-facets.js";
import { filterRowsBySearchTokens } from "../shared/search.js";

export const SERVICE_TYPES = Object.freeze([
  Object.freeze({ key: "repair", label: MOVEMENT_REASONS.repair, tone: "blue-1" }),
  Object.freeze({ key: "retention", label: MOVEMENT_REASONS.retention, tone: "blue-2" }),
  Object.freeze({ key: "claim", label: MOVEMENT_REASONS.claim, tone: "blue-3" }),
  Object.freeze({ key: "rotation", label: MOVEMENT_REASONS.rotation, tone: "blue-4" }),
  Object.freeze({ key: "discard", label: MOVEMENT_REASONS.discard, tone: "alert" }),
  Object.freeze({ key: "retread", label: MOVEMENT_REASONS.retread, tone: "milestone" }),
  Object.freeze({ key: "balancing", label: MOVEMENT_REASONS.balancing, tone: "blue-5" }),
  Object.freeze({ key: "installation", label: "INSTALACIÓN", tone: "blue-6" }),
]);

const SERVICE_TYPE_BY_KEY = new Map(SERVICE_TYPES.map((type) => [type.key, type]));
const SERVICE_TYPE_BY_LABEL = new Map(SERVICE_TYPES.map((type) => [type.label, type]));

const SEARCHABLE_COLUMNS = Object.freeze([
  "service_type",
  "plate",
  "position_number",
  "casing_code",
  "brand_name",
  "brand_key",
  "size_name",
  "size_key",
  "design_name",
  "retread_design",
  "condition",
  "captured_by_name",
  "requested_by_name",
  "assigned_to_name",
  "observations",
]);

function text(value) {
  return String(value ?? "").trim();
}

function typeValues(rows) {
  const present = new Set((Array.isArray(rows) ? rows : []).map((row) => row?.service_type));
  return SERVICE_TYPES.filter((type) => present.has(type.key)).map((type) => type.label);
}

function positionValue(value) {
  const position = Number(value);
  return Number.isInteger(position) && position > 0 ? `P${position}` : null;
}

function positionValues(rows) {
  return [...new Set((Array.isArray(rows) ? rows : [])
    .map((row) => Number(row?.position_number))
    .filter((value) => Number.isInteger(value) && value > 0))]
    .sort((left, right) => left - right)
    .map((value) => `P${value}`);
}

export const SERVICE_FACETS = Object.freeze([
  {
    key: "tipo", label: "Tipo de servicio",
    values: typeValues,
    match: (row, value) => SERVICE_TYPE_BY_LABEL.get(value)?.key === row?.service_type || value === row?.service_type,
  },
  { key: "unidad", label: "Unidad", values: (rows) => distinctValues(rows, "plate"), match: (row, value) => row?.plate === value },
  { key: "posicion", label: "Posición", values: positionValues, match: (row, value) => positionValue(row?.position_number) === value },
  { key: "marca", label: "Marca", values: (rows) => distinctValues(rows, "brand_key"), match: (row, value) => row?.brand_key === value },
  { key: "medida", label: "Medida", values: (rows) => distinctValues(rows, "size_key"), match: (row, value) => row?.size_key === value },
  { key: "condicion", label: "Condición", values: (rows) => distinctValues(rows, "condition"), match: (row, value) => row?.condition === value },
  { key: "reencauche", label: "Diseño de reencauche", values: (rows) => distinctValues(rows, "retread_design"), match: (row, value) => row?.retread_design === value },
  { key: "operario", label: "Operario", values: (rows) => distinctValues(rows, "captured_by_name"), match: (row, value) => row?.captured_by_name === value },
  { key: "supervisor", label: "Supervisor", values: (rows) => distinctValues(rows, "requested_by_name"), match: (row, value) => row?.requested_by_name === value },
  {
    key: "mes", label: "Mes de servicio",
    values: (rows) => distinctInspectionMonthValues(rows, "captured_on"),
    match: (row, value) => matchInspectionMonthFacet(row, value, "captured_on"),
  },
  {
    key: "fecha", label: "Fecha de servicio",
    values: (rows) => distinctInspectionExactDateValues(rows, "captured_on"),
    match: (row, value) => matchInspectionDateFacet(row, value, "captured_on"),
  },
  { key: "reconciliacion", label: "Reconciliación", values: (rows) => distinctValues(rows, "reconciliation_status"), match: (row, value) => row?.reconciliation_status === value },
]);

const FACET_BY_KEY = new Map(SERVICE_FACETS.map((facet) => [facet.key, facet]));

export function serviceTypeMeta(type) {
  return SERVICE_TYPE_BY_KEY.get(type) ?? null;
}

export function chipsFromSearch(search = "") {
  const params = new URLSearchParams(search);
  const chips = [];
  for (const facet of SERVICE_FACETS) {
    for (const value of params.getAll(facet.key)) {
      if (text(value)) chips.push({ facet: facet.key, value, label: `${facet.label}: ${value}` });
    }
  }
  return chips;
}

export function searchForChips(chips = []) {
  const params = new URLSearchParams();
  for (const chip of Array.isArray(chips) ? chips : []) {
    if (FACET_BY_KEY.has(chip?.facet) && text(chip?.value)) {
      params.append(chip.facet, chip.value);
    }
  }
  return params.toString();
}

export function filterServices(rows, { chips = [], query = "" } = {}) {
  return filterRowsBySearchTokens(
    applyFilters(rows, chips, SERVICE_FACETS),
    query,
    SEARCHABLE_COLUMNS,
  );
}

export function summarizeServices(rows) {
  const source = Array.isArray(rows) ? rows : [];
  if (source.length === 0) return { total: 0, firstDate: null, byType: [] };

  const counts = new Map();
  const units = new Set();
  const orders = new Set();
  const dates = [];
  for (const row of source) {
    if (SERVICE_TYPE_BY_KEY.has(row?.service_type)) {
      counts.set(row.service_type, (counts.get(row.service_type) ?? 0) + 1);
    }
    if (row?.unit_id != null) units.add(row.unit_id);
    else if (text(row?.plate)) units.add(`plate:${text(row.plate)}`);
    if (row?.order_id != null) orders.add(row.order_id);
    if (/^\d{4}-\d{2}-\d{2}$/.test(text(row?.captured_on))) dates.push(row.captured_on);
  }
  dates.sort();

  return {
    total: source.length,
    units: units.size,
    orders: orders.size,
    firstDate: dates[0] ?? null,
    lastDate: dates.at(-1) ?? null,
    byType: SERVICE_TYPES
      .filter((type) => (counts.get(type.key) ?? 0) > 0)
      .map((type) => ({ ...type, count: counts.get(type.key) })),
  };
}

export function segmentsFromSummary(summary) {
  const entries = (Array.isArray(summary?.byType) ? summary.byType : [])
    .filter((entry) => Number(entry?.count) > 0)
    .map((entry) => ({ ...entry, count: Number(entry.count) }));
  const total = entries.reduce((sum, entry) => sum + entry.count, 0);
  if (!total) return [];

  const segments = entries.map((entry) => ({
    ...entry,
    percentage: Math.round((entry.count / total) * 1000) / 10,
  }));
  const roundedTotal = segments.reduce((sum, segment) => sum + segment.percentage, 0);
  const residual = Math.round((100 - roundedTotal) * 10) / 10;
  if (residual) {
    let largestIndex = 0;
    for (let index = 1; index < segments.length; index += 1) {
      if (segments[index].count > segments[largestIndex].count) largestIndex = index;
    }
    // Conserva una cifra decimal al presentar (`toFixed(1)`) y absorbe también
    // el residuo binario de IEEE-754: la suma en JavaScript queda en 100 exacto.
    segments[largestIndex].percentage += 100 - roundedTotal;
  }
  return segments;
}

export function unitHref(row) {
  const plate = text(row?.plate);
  return plate ? `Inspecciones por unidad.html?plate=${encodeURIComponent(plate)}` : null;
}

export function casingHistoryHref(row) {
  const code = text(row?.casing_code);
  if (!code || row?.code_unreadable === true || row?.casing_exists !== true) return null;
  return `historial-neumatico.html?serie=${encodeURIComponent(code)}&from=servicios`;
}
