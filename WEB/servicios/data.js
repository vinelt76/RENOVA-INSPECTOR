export const SERVICES_FETCH_LIMIT = 2000;

export const SERVICE_COLUMNS = Object.freeze([
  "service_id",
  "order_id",
  "sequence",
  "company_id",
  "company_name",
  "unit_id",
  "plate",
  "vehicle_config",
  "service_type",
  "direction",
  "position_number",
  "casing_code",
  "casing_exists",
  "code_unreadable",
  "brand_name",
  "brand_key",
  "size_name",
  "size_key",
  "design_name",
  "retread_design",
  "rtd_min_mm",
  "condition",
  "observations",
  "captured_by",
  "captured_by_name",
  "captured_at",
  "captured_on",
  "reconciliation_status",
  "odometer_km",
  "scheduled_for",
  "completed_at",
  "requested_by_name",
  "assigned_to_name",
  "pair_position_number",
  "pair_casing_code",
  "pair_condition",
  "pair_rtd_min_mm",
  "rotation_pairing",
  "entry_origin_position",
]);

const NUMERIC_COLUMNS = Object.freeze([
  "sequence",
  "position_number",
  "rtd_min_mm",
  "odometer_km",
  "pair_position_number",
  "pair_rtd_min_mm",
  "entry_origin_position",
]);

function getFetchView(dependency) {
  if (typeof dependency === "function") return dependency;

  const client = dependency ?? globalThis.RenovaSupabase;
  if (typeof client?.fetchView !== "function") {
    throw new TypeError("RenovaSupabase.fetchView no está disponible");
  }
  return client.fetchView.bind(client);
}

function normalizeServiceRow(row) {
  const normalized = { ...row };
  for (const column of NUMERIC_COLUMNS) {
    if (normalized[column] != null) normalized[column] = Number(normalized[column]);
  }
  return normalized;
}

export async function loadServices({ limit = SERVICES_FETCH_LIMIT } = {}, dependency) {
  const safeLimit = Number.isInteger(Number(limit)) && Number(limit) > 0
    ? Number(limit)
    : SERVICES_FETCH_LIMIT;
  const sourceRows = await getFetchView(dependency)("v_tire_services", {
    select: SERVICE_COLUMNS.join(","),
    order: "captured_at.desc,sequence.asc",
    limit: String(safeLimit),
  });
  const rows = (Array.isArray(sourceRows) ? sourceRows : []).map(normalizeServiceRow);
  return { rows, limit: safeLimit, truncated: rows.length === safeLimit };
}

export async function loadServicesProfile(userId, dependency) {
  if (!userId) return null;
  const rows = await getFetchView(dependency)("profiles", {
    select: "id,company_id,full_name,role,active",
    id: `eq.${userId}`,
    limit: "1",
  });
  return rows[0] ?? null;
}
