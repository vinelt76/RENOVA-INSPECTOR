import { MOVEMENT_REASONS } from "./supervisor-order-model.js";

const SHORT_REASON = Object.freeze({
  repair: "A REPARACIÓN",
  retention: "A RETÉN",
  claim: "A RECLAMO",
  rotation: "ROTACIÓN",
  discard: "A SCRAP",
  retread: "A REENCAUCHE",
  balancing: "A BALANCEO",
});

export function projectSupervisorOrder(remoteState = [], draft = { items: [] }, selected = null) {
  const requests = new Map();
  for (const item of draft.items ?? []) {
    const position = Number(item.position);
    if (!requests.has(position)) requests.set(position, { exit: null, entry: null });
    requests.get(position)[item.direction] = item;
  }

  const projection = new Map();
  for (const row of [...remoteState].sort((a, b) => Number(a.position_number) - Number(b.position_number))) {
    const position = Number(row.position_number);
    const request = requests.get(position) ?? {};
    const hasExit = Boolean(request.exit);
    const hasEntry = Boolean(request.entry);
    const remoteOccupancy = row.is_empty === true
      ? row.baseline_pending === true ? "baseline_pending" : "empty"
      : "occupied";
    const occupancy = hasEntry ? "occupied" : hasExit ? "empty" : remoteOccupancy;
    const role = hasEntry ? "destination" : hasExit ? "origin" : "none";
    const label = hasExit && hasEntry
      ? "CAMBIO ORDENADO"
      : hasEntry
        ? "INSTALAR"
        : hasExit
          ? SHORT_REASON[request.exit.reason] ?? MOVEMENT_REASONS[request.exit.reason] ?? "SALIDA"
          : remoteOccupancy === "baseline_pending"
            ? "LÍNEA BASE PENDIENTE"
            : remoteOccupancy === "empty" ? "VACÍA" : "INSTALADO";

    projection.set(position, {
      occupancy,
      role,
      label,
      flags: {
        selected: Number(selected) === position,
        mismatch: row.code_mismatch === true,
        conflict: false,
        retention: request.exit?.reason === "retention",
        discard: request.exit?.reason === "discard",
        mount: hasEntry,
        swap: request.exit?.reason === "rotation" || /Rotar desde/i.test(request.entry?.notes ?? ""),
      },
    });
  }
  return projection;
}

