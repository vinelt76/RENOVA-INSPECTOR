export const MOVEMENT_REASONS = Object.freeze({
  repair: "PARA REPARACIÓN",
  retention: "PARA RETÉN",
  claim: "PARA RECLAMO",
  rotation: "ROTACIÓN / INTERCAMBIO",
  discard: "PARA SCRAP",
  retread: "REENCAUCHE",
  balancing: "BALANCEO",
});

// `fleet_manager` es el rol histórico de las cuentas web que ya operan como
// Supervisor de Neumáticos. `tire_supervisor` queda como rol dedicado nuevo.
export const SUPERVISOR_ORDER_ROLES = Object.freeze([
  "tire_supervisor",
  "fleet_manager",
  "admin",
]);

const DIRECTIONS = new Set(["exit", "entry"]);

function positionNumber(value) {
  const position = Number(value);
  return Number.isInteger(position) && position > 0 ? position : null;
}

function cleanNotes(value) {
  const notes = String(value ?? "").trim();
  return notes || undefined;
}

function cleanText(value) {
  const text = String(value ?? "").trim();
  return text || undefined;
}

function inventoryEntry(item) {
  const lifeCycleId = cleanText(item?.life_cycle_id);
  if (!lifeCycleId) return {};
  return {
    life_cycle_id: lifeCycleId,
    ...(cleanText(item.casing_code) ? { casing_code: cleanText(item.casing_code) } : {}),
    ...(cleanText(item.brand_name) ? { brand_name: cleanText(item.brand_name) } : {}),
    ...(cleanText(item.model_name) ? { model_name: cleanText(item.model_name) } : {}),
    ...(cleanText(item.size_name) ? { size_name: cleanText(item.size_name) } : {}),
    ...(cleanText(item.condition) ? { condition: cleanText(item.condition) } : {}),
    ...(cleanText(item.retread_design) ? { retread_design: cleanText(item.retread_design) } : {}),
    ...(item.last_rtd_mm != null && Number.isFinite(Number(item.last_rtd_mm))
      ? { last_rtd_mm: Number(item.last_rtd_mm) }
      : {}),
  };
}

function normalizeItem(item) {
  const direction = DIRECTIONS.has(item?.direction) ? item.direction : null;
  const position = positionNumber(item?.position);
  const reason = direction === "exit" && MOVEMENT_REASONS[item?.reason]
    ? item.reason
    : undefined;
  // `without_entry` declara que la salida deja la posición vacía a propósito. Solo
  // tiene sentido en una salida, y viaja como clave extra dentro de `request_items`:
  // `create_tire_movement_order` valida direction/position/reason e ignora el resto.
  const withoutEntry = direction === "exit" && item?.without_entry === true;
  return {
    direction,
    position,
    ...(reason ? { reason } : {}),
    ...(withoutEntry ? { without_entry: true } : {}),
    ...(direction === "entry" ? inventoryEntry(item) : {}),
    ...(cleanNotes(item?.notes) ? { notes: cleanNotes(item.notes) } : {}),
  };
}

// Un servicio es una posición atendida: lo que sale y lo que entra en esa misma
// posición (ADR-0008). Agrupar por posición es cómo lo lee la planilla de la
// empresa, y es la forma en la que la vista `v_tire_services` parea.
export function groupDraftByPosition(draft) {
  const groups = new Map();
  for (const raw of draft?.items ?? []) {
    const item = normalizeItem(raw);
    if (!item.direction || !item.position) continue;
    if (!groups.has(item.position)) groups.set(item.position, { position: item.position, exit: null, entry: null });
    groups.get(item.position)[item.direction] = item;
  }
  return [...groups.values()].sort((a, b) => a.position - b.position);
}

function completenessErrors(draft) {
  const errors = [];
  for (const group of groupDraftByPosition(draft)) {
    if (!group.exit || group.entry || group.exit.without_entry) continue;
    errors.push(
      `P${group.position}: falta el ingreso. Indica qué neumático entra, o marca la posición como sin reemplazo.`,
    );
  }
  return errors;
}

export function localToday(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function createOrderId(cryptoApi = globalThis.crypto) {
  if (typeof cryptoApi?.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  if (typeof cryptoApi?.getRandomValues !== "function") {
    throw new Error("El navegador no dispone de generación aleatoria compatible.");
  }

  const bytes = new Uint8Array(16);
  cryptoApi.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}

export function createOrderDraft(source = {}, now = new Date()) {
  return {
    version: 1,
    scheduledFor: /^\d{4}-\d{2}-\d{2}$/.test(source?.scheduledFor ?? "")
      ? source.scheduledFor
      : localToday(now),
    instructions: String(source?.instructions ?? ""),
    items: Array.isArray(source?.items)
      ? source.items.map(normalizeItem).filter((item) => item.direction && item.position)
      : [],
  };
}

export function orderDraftKey({ userId, companyId, unitId }) {
  return `renova:movement-order:v1:${userId}:${companyId}:${unitId}`;
}

// `requireCompleteness` es la puerta de emisión, no la de edición: mientras el
// supervisor arma el borrador una salida sin ingreso es un estado intermedio
// normal. Al emitir deja de serlo, porque produce una posición vacía en la unidad.
export function validateOrderDraft(draft, configuredPositions = [], { requireCompleteness = true } = {}) {
  const errors = [];
  const positions = new Set(configuredPositions.map(positionNumber).filter(Boolean));

  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft?.scheduledFor ?? "")) {
    errors.push("Elige una fecha programada válida.");
  }
  if (!Array.isArray(draft?.items) || draft.items.length === 0) {
    errors.push("Agrega al menos una salida, entrada o rotación.");
    return errors;
  }

  const seen = new Set();
  draft.items.forEach((rawItem, index) => {
    const item = normalizeItem(rawItem);
    const row = index + 1;
    if (!item.direction || !item.position || (positions.size && !positions.has(item.position))) {
      errors.push(`Indicación ${row}: posición inválida.`);
      return;
    }
    if (item.direction === "exit" && !item.reason) {
      errors.push(`P${item.position}: la salida necesita un destino o razón.`);
    }
    const key = `${item.direction}:${item.position}`;
    if (seen.has(key)) errors.push(`P${item.position}: la ${item.direction === "exit" ? "salida" : "entrada"} está repetida.`);
    seen.add(key);
  });
  if (requireCompleteness) errors.push(...completenessErrors(draft));
  return errors;
}

export function addOrderItem(draft, item, configuredPositions = []) {
  const normalized = normalizeItem(item);
  const next = { ...draft, items: [...(draft.items ?? []), normalized] };
  const errors = validateOrderDraft(next, configuredPositions, { requireCompleteness: false }).filter(
    (message) => !message.startsWith("Elige una fecha"),
  );
  return errors.length ? { ok: false, errors, draft } : { ok: true, draft: next };
}

/**
 * Los servicios distintos de rotación se agregan como una pareja inseparable:
 * sale el neumático actual y entra el ciclo elegido del inventario en la misma
 * posición. La rotación conserva su flujo propio entre dos posiciones.
 */
export function addServiceFromInventory(
  draft,
  { position, reason, inventoryItem, notes } = {},
  configuredPositions = [],
) {
  if (!MOVEMENT_REASONS[reason] || reason === "rotation") {
    return { ok: false, errors: ["Elige un servicio distinto de rotación."], draft };
  }
  if (!cleanText(inventoryItem?.life_cycle_id)) {
    return { ok: false, errors: ["Elige un neumático disponible del inventario."], draft };
  }
  const alreadySelected = (draft?.items ?? []).some(
    (item) => item?.direction === "entry" && item?.life_cycle_id === inventoryItem.life_cycle_id,
  );
  if (alreadySelected) {
    return { ok: false, errors: ["Ese neumático ya entra en otra posición del borrador."], draft };
  }

  const next = {
    ...draft,
    items: [
      ...(draft?.items ?? []),
      normalizeItem({ direction: "exit", position, reason, notes }),
      normalizeItem({
        direction: "entry",
        position,
        ...inventoryItem,
        notes: `Desde inventario${cleanNotes(notes) ? ` · ${cleanNotes(notes)}` : ""}`,
      }),
    ],
  };
  const errors = validateOrderDraft(next, configuredPositions, { requireCompleteness: false });
  return errors.length ? { ok: false, errors, draft } : { ok: true, draft: next };
}

// Declara que la salida de esa posición no lleva reemplazo. Es la única forma de
// emitir una posición que queda vacía a propósito: por descuido ya no se puede.
export function setExitWithoutEntry(draft, position, without = true) {
  const target = positionNumber(position);
  if (!target) return draft;
  return {
    ...draft,
    items: (draft.items ?? []).map((raw) => {
      const item = normalizeItem(raw);
      if (item.direction !== "exit" || item.position !== target) return item;
      return normalizeItem({ ...item, without_entry: without === true });
    }),
  };
}

// Quitar media posición dejaría un borrador incompleto sin que el supervisor lo
// pida: se quita la posición entera, salida e ingreso.
export function removeOrderPosition(draft, position) {
  const target = positionNumber(position);
  if (!target) return draft;
  return {
    ...draft,
    items: (draft.items ?? []).filter((raw) => normalizeItem(raw).position !== target),
  };
}

export function addRotation(draft, sourcePosition, targetPosition, notes, configuredPositions = []) {
  const source = positionNumber(sourcePosition);
  const target = positionNumber(targetPosition);
  if (!source || !target || source === target) {
    return { ok: false, errors: ["La rotación necesita dos posiciones diferentes."], draft };
  }
  // Una rotación son DOS posiciones atendidas, no un casco reubicándose: de P3
  // sale un neumático y entra el de P7, y de P7 sale ese y entra el de P3. Emitir
  // solo `exit@P3 + entry@P7` dejaba P3 vacía y al ocupante de P7 sin registro de
  // salida (ADR-0008).
  //
  // El orden no es cosmético: `v_tire_services` parea el ingreso con la salida de
  // `sequence - 1`, así que cada entrada va inmediatamente después de la salida de
  // su misma posición. Agruparlas de otra forma rompe el pareo en silencio.
  const extra = cleanNotes(notes) ? ` · ${cleanNotes(notes)}` : "";
  const next = {
    ...draft,
    items: [
      ...(draft.items ?? []),
      normalizeItem({ direction: "exit", position: source, reason: "rotation", notes }),
      normalizeItem({ direction: "entry", position: source, notes: `Rotar desde P${target}${extra}` }),
      normalizeItem({ direction: "exit", position: target, reason: "rotation", notes }),
      normalizeItem({ direction: "entry", position: target, notes: `Rotar desde P${source}${extra}` }),
    ],
  };
  const errors = validateOrderDraft(next, configuredPositions, { requireCompleteness: false });
  return errors.length ? { ok: false, errors, draft } : { ok: true, draft: next };
}

export function orderRpcPayload(draft) {
  return (draft.items ?? []).map((item) => normalizeItem(item));
}
