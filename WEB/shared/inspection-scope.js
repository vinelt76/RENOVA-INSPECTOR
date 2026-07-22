function compareInspectionDesc(left, right) {
  return String(right.inspectedOn).localeCompare(String(left.inspectedOn))
    || String(right.createdAt || "").localeCompare(String(left.createdAt || ""))
    || String(right.id).localeCompare(String(left.id));
}

/**
 * Índice liviano para decidir qué filas pedir a v_inspection_dashboard_rows.
 * Las mediciones pesadas no forman parte de este índice.
 */
export function createInspectionScopeIndex(inspections, units) {
  const plateByUnitId = new Map();
  const unitIdByPlate = new Map();
  for (const unit of Array.isArray(units) ? units : []) {
    if (!unit?.id || !unit?.plate) continue;
    const plate = String(unit.plate).trim();
    if (!plate) continue;
    plateByUnitId.set(unit.id, plate);
    unitIdByPlate.set(plate, unit.id);
  }

  const rows = (Array.isArray(inspections) ? inspections : [])
    .filter((row) => row?.id && row?.unit_id && /^\d{4}-\d{2}-\d{2}$/.test(row?.inspected_on || ""))
    .map((row) => ({
      id: row.id,
      unitId: row.unit_id,
      inspectedOn: row.inspected_on,
      createdAt: row.created_at || null,
    }))
    .sort(compareInspectionDesc);

  const dates = [...new Set(rows.map((row) => row.inspectedOn))].sort().reverse();
  const plates = [...new Set(rows.map((row) => plateByUnitId.get(row.unitId)).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "es", { numeric: true, sensitivity: "base" }));

  return { rows, dates, plates, plateByUnitId, unitIdByPlate };
}

/**
 * Precedencia temporal:
 *   1. fecha explícita → esa fecha (historia intencional);
 *   2. unidad explícita → última inspección de cada unidad;
 *   3. sin ambas → última fecha global.
 */
export function resolveInspectionScope(
  index,
  chips,
  formatDate = (value) => value,
  formatMonth = (value) => value,
) {
  const safeIndex = index || { rows: [], dates: [], unitIdByPlate: new Map() };
  const chipList = Array.isArray(chips) ? chips : [];
  const dateValues = new Set(chipList
    .filter((chip) => chip?.facet === "fecha" || chip?.facet === "mes")
    .map((chip) => chip.value));
  const dates = (safeIndex.dates || []).filter((date) =>
    dateValues.has(date)
    || dateValues.has(formatDate(date))
    || dateValues.has(formatMonth(String(date).slice(0, 7)))
  );
  if (dates.length) {
    const selectedMonths = [...new Set(dates
      .map((date) => formatMonth(String(date).slice(0, 7)))
      .filter((month) => dateValues.has(month)))];
    return {
      kind: "dates",
      column: "inspected_on",
      values: dates,
      label: selectedMonths.length === 1 && !dateValues.has(formatDate(dates[0]))
        ? `Mes ${selectedMonths[0]}`
        : dates.length === 1 ? `Fecha ${formatDate(dates[0])}` : `${dates.length} fechas seleccionadas`,
    };
  }

  const plates = [...new Set(chipList
    .filter((chip) => chip?.facet === "unidad" && chip.value)
    .map((chip) => chip.value))];
  if (plates.length) {
    const unitIds = new Set(plates.map((plate) => safeIndex.unitIdByPlate?.get(plate)).filter(Boolean));
    const foundUnitIds = new Set();
    const inspectionIds = [];
    for (const row of safeIndex.rows || []) {
      if (!unitIds.has(row.unitId) || foundUnitIds.has(row.unitId)) continue;
      foundUnitIds.add(row.unitId);
      inspectionIds.push(row.id);
    }
    return {
      kind: "units-latest",
      column: "inspection_id",
      values: inspectionIds,
      label: plates.length === 1
        ? `Última inspección de la unidad ${plates[0]}`
        : `Última inspección de ${plates.length} unidades`,
    };
  }

  // Una faceta analítica pide el último estado de toda la flota, no solamente
  // las filas de la última fecha global. Así IZE2W/modelos de unidades que
  // inspeccionaron otro día siguen siendo encontrables sin bajar el historial.
  const hasAnalyticalFilter = chipList.some((chip) => [
    "codigo", "estado", "marca", "modelo", "medida", "condicion", "diseno", "eje", "reencauche", "desecho",
  ].includes(chip?.facet));
  if (hasAnalyticalFilter) {
    const foundUnitIds = new Set();
    const inspectionIds = [];
    for (const row of safeIndex.rows || []) {
      if (foundUnitIds.has(row.unitId)) continue;
      foundUnitIds.add(row.unitId);
      inspectionIds.push(row.id);
    }
    return {
      kind: "fleet-latest",
      column: "inspection_id",
      values: inspectionIds,
      label: "Última inspección de cada unidad",
    };
  }

  const latestDate = safeIndex.dates?.[0] || null;
  return {
    kind: "global-latest",
    column: "inspected_on",
    values: latestDate ? [latestDate] : [],
    label: latestDate ? `Última fecha · ${formatDate(latestDate)}` : "Sin inspecciones",
  };
}

export function postgrestFilterForScope(scope) {
  const values = Array.isArray(scope?.values) ? scope.values.filter(Boolean) : [];
  if (!scope?.column || !values.length) return null;
  return {
    column: scope.column,
    value: values.length === 1 ? `eq.${values[0]}` : `in.(${values.join(",")})`,
  };
}
