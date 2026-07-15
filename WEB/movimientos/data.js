const UNIT_POSITION_STATE_COLUMNS = [
  "company_id",
  "unit_id",
  "plate",
  "config_id",
  "position_number",
  "side",
  "axle_number",
  "axle_type",
  "is_ground",
  "installation_id",
  "life_cycle_id",
  "casing_id",
  "casing_code",
  "brand_name",
  "model_name",
  "size_name",
  "condition",
  "retread_design",
  "cycle_number",
  "installed_at",
  "odometer_at_install",
  "rtd_at_install_mm",
  "is_empty",
  "last_inspected_on",
  "last_rtd_movi_mm",
  "last_pressure_psi",
  "last_inspection_tire_code",
  "code_mismatch",
  "installation_origin",
  "baseline_pending",
  "last_measurement_id",
  "last_brand_name",
  "last_model_name",
  "last_size_name",
  "last_condition",
  "last_retread_design",
  "last_odometer_km",
].join(",");

const AVAILABLE_INVENTORY_COLUMNS = [
  "company_id",
  "life_cycle_id",
  "casing_id",
  "casing_code",
  "brand_name",
  "model_name",
  "size_name",
  "condition",
  "cycle_number",
  "retread_design",
  "otd_mm",
  "last_removed_at",
  "last_removal_reason",
  "last_rtd_mm",
  "days_in_inventory",
].join(",");

const POSITION_NUMERIC_COLUMNS = [
  "rtd_at_install_mm",
  "last_rtd_movi_mm",
  "last_pressure_psi",
  "last_odometer_km",
];

const INVENTORY_NUMERIC_COLUMNS = ["otd_mm", "last_rtd_mm"];

function getFetchView(dependency) {
  if (typeof dependency === "function") return dependency;

  const client = dependency ?? globalThis.RenovaSupabase;
  if (typeof client?.fetchView !== "function") {
    throw new TypeError("RenovaSupabase.fetchView no está disponible");
  }

  return client.fetchView.bind(client);
}

function normalizeNumericColumns(row, columns) {
  const normalized = { ...row };
  for (const column of columns) {
    if (normalized[column] != null) {
      normalized[column] = Number(normalized[column]);
    }
  }
  return normalized;
}

/**
 * Resuelve la unidad visible para la sesión actual. La placa de navegación
 * tiene prioridad para evitar una lectura adicional de la inspección.
 */
export async function resolveUnitId({ inspectionId, plate } = {}, dependency) {
  let resolvedPlate = plate;

  if (!resolvedPlate && !inspectionId) return null;

  const fetchView = getFetchView(dependency);

  if (!resolvedPlate && inspectionId) {
    const inspectionRows = await fetchView("v_inspection_dashboard_rows", {
      select: "plate",
      inspection_id: `eq.${inspectionId}`,
      limit: "1",
    });
    resolvedPlate = inspectionRows[0]?.plate;
  }

  if (!resolvedPlate) return null;

  const unitRows = await fetchView("v_unit_position_state", {
    select: "unit_id,plate",
    plate: `eq.${resolvedPlate}`,
    order: "position_number.asc",
    limit: "1",
  });

  return unitRows[0]?.unit_id ?? null;
}

/** Carga todas las posiciones configuradas, incluidas las vacías. */
export async function loadUnitPositionState(unitId, dependency) {
  const rows = await getFetchView(dependency)("v_unit_position_state", {
    select: UNIT_POSITION_STATE_COLUMNS,
    unit_id: `eq.${unitId}`,
    order: "position_number.asc",
  });

  return rows.map((row) => normalizeNumericColumns(row, POSITION_NUMERIC_COLUMNS));
}

/** Carga los ciclos actualmente disponibles para montaje. */
export async function loadAvailableInventory(dependency) {
  const rows = await getFetchView(dependency)("v_tire_inventory_available", {
    select: AVAILABLE_INVENTORY_COLUMNS,
    order: "last_removed_at.desc.nullslast,casing_code.asc",
  });

  return rows.map((row) => normalizeNumericColumns(row, INVENTORY_NUMERIC_COLUMNS));
}
