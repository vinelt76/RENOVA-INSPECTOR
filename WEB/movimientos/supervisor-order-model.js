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

function normalizeItem(item) {
  const direction = DIRECTIONS.has(item?.direction) ? item.direction : null;
  const position = positionNumber(item?.position);
  const reason = direction === "exit" && MOVEMENT_REASONS[item?.reason]
    ? item.reason
    : undefined;
  return {
    direction,
    position,
    ...(reason ? { reason } : {}),
    ...(cleanNotes(item?.notes) ? { notes: cleanNotes(item.notes) } : {}),
  };
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

export function validateOrderDraft(draft, configuredPositions = []) {
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
  return errors;
}

export function addOrderItem(draft, item, configuredPositions = []) {
  const normalized = normalizeItem(item);
  const next = { ...draft, items: [...(draft.items ?? []), normalized] };
  const errors = validateOrderDraft(next, configuredPositions).filter(
    (message) => !message.startsWith("Elige una fecha"),
  );
  return errors.length ? { ok: false, errors, draft } : { ok: true, draft: next };
}

export function addRotation(draft, sourcePosition, targetPosition, notes, configuredPositions = []) {
  const source = positionNumber(sourcePosition);
  const target = positionNumber(targetPosition);
  if (!source || !target || source === target) {
    return { ok: false, errors: ["La rotación necesita dos posiciones diferentes."], draft };
  }
  const next = {
    ...draft,
    items: [
      ...(draft.items ?? []),
      normalizeItem({ direction: "exit", position: source, reason: "rotation", notes }),
      normalizeItem({
        direction: "entry",
        position: target,
        notes: `Rotar desde P${source}${cleanNotes(notes) ? ` · ${cleanNotes(notes)}` : ""}`,
      }),
    ],
  };
  const errors = validateOrderDraft(next, configuredPositions);
  return errors.length ? { ok: false, errors, draft } : { ok: true, draft: next };
}

export function removeOrderItem(draft, index) {
  return { ...draft, items: (draft.items ?? []).filter((_, itemIndex) => itemIndex !== index) };
}

export function orderRpcPayload(draft) {
  return (draft.items ?? []).map((item) => normalizeItem(item));
}
