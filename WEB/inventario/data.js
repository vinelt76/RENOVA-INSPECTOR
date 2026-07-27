const RETENTION_COLUMNS = [
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

const DISCARDED_COLUMNS = [
  "casing_id",
  "current_life_cycle_id",
  "code",
  "brand_name",
  "model_name",
  "size_name",
  "condition",
  "retread_design",
  "cost",
  "inventory_status",
  "last_removal_reason",
  "last_unit_plate",
  "last_position_number",
  "last_removed_at",
  "last_removal_discard_cause",
  "discarded_at",
].join(",");

const RETENTION_NUMERIC_COLUMNS = ["cycle_number", "otd_mm", "last_rtd_mm", "days_in_inventory"];
const DISCARDED_NUMERIC_COLUMNS = ["cost", "last_position_number"];

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
    if (normalized[column] != null) normalized[column] = Number(normalized[column]);
  }
  return normalized;
}

/**
 * Devuelve todo el inventario disponible para montaje. Retén es un estado
 * derivado: no se filtra por el motivo del último retiro.
 */
export async function loadRetentionInventory(dependency) {
  const rows = await getFetchView(dependency)("v_tire_inventory_available", {
    select: RETENTION_COLUMNS,
    order: "last_removed_at.desc.nullslast,casing_code.asc",
  });

  return rows.map((row) => normalizeNumericColumns(row, RETENTION_NUMERIC_COLUMNS));
}

/** Devuelve cascos dados de baja definitivamente, una fila por casco. */
export async function loadDiscardedInventory(dependency) {
  const rows = await getFetchView(dependency)("v_inventory_status", {
    select: DISCARDED_COLUMNS,
    inventory_status: "eq.discarded",
    order: "discarded_at.desc.nullslast,code.asc",
  });

  if (rows.some((row) => row?.inventory_status !== "discarded")) {
    throw new Error("Contrato inválido: v_inventory_status devolvió una fila no descartada.");
  }

  return rows.map((row) => normalizeNumericColumns(row, DISCARDED_NUMERIC_COLUMNS));
}

/**
 * Nombre de la empresa activa para la insignia de sesión.
 *
 * `v_inventory_status` y `v_tire_inventory_available` exponen `company_id` pero no el nombre, así
 * que se resuelve desde el perfil autenticado —igual que hace la app de movimientos—. Devuelve
 * `null` si no se puede resolver: la insignia prefiere quedarse sin detalle antes que caer al
 * correo de la cuenta, que no es información de empresa y se proyecta en pantalla.
 */
export async function loadActiveCompanyName(userId, dependency) {
  if (!userId) return null;
  try {
    const rows = await getFetchView(dependency)("profiles", {
      select: "company_id,companies(name)",
      id: `eq.${userId}`,
      limit: "1",
    });
    return rows[0]?.companies?.name ?? null;
  } catch (error) {
    console.warn("Inventario: no se pudo resolver la empresa activa.", error);
    return null;
  }
}

/** Carga ambas pestañas concurrentemente y conserva errores para la capa de UI. */
export async function loadInventoryScreenData(dependency) {
  const [retention, discarded] = await Promise.all([
    loadRetentionInventory(dependency),
    loadDiscardedInventory(dependency),
  ]);

  const retainedCasingIds = new Set(retention.map((row) => row?.casing_id).filter(Boolean));
  const duplicated = discarded.find((row) => retainedCasingIds.has(row?.casing_id));
  if (duplicated) {
    throw new Error("Contrato inválido: un casco aparece en Retén y Descartados.");
  }

  return { retention, discarded };
}
