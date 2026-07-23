import type {
  EntryOrigin,
  ExecutionService,
  ExecutionItem,
  MovementDraft,
  MovementOrder,
  MovementReason,
  RequestedMovement,
} from './types';

export const REASON_LABELS: Readonly<Record<MovementReason, string>> = {
  repair: 'PARA REPARACIÓN',
  retention: 'PARA RETÉN',
  claim: 'PARA RECLAMO',
  rotation: 'ROTACIÓN',
  discard: 'PARA SCRAP',
  retread: 'REENCAUCHE',
  balancing: 'BALANCEO',
};

const USERNAME_SUFFIX = '@operarios.renova.local';

export function loginIdentifierToEmail(identifier: string): string {
  const normalized = identifier.trim().toLowerCase();
  return normalized.includes('@') ? normalized : `${normalized}${USERNAME_SUFFIX}`;
}

const TIRE_CONDITIONS = new Set(['N', 'R1', 'R2', 'R3', 'R4']);
const ROTATION_ORIGIN_PATTERN = /(?:ROTAR|DESDE)\s+P(\d+)/i;

function entryOrigin(request: RequestedMovement): {
  type: EntryOrigin;
  position: number | null;
} {
  if (request.direction !== 'entry') return { type: 'unknown', position: null };
  const explicitPosition = Number(request.origin_position);
  if (request.origin_type === 'vehicle' && Number.isInteger(explicitPosition) && explicitPosition > 0) {
    return { type: 'vehicle', position: explicitPosition };
  }
  if (request.origin_type === 'inventory' || request.life_cycle_id) {
    return { type: 'inventory', position: null };
  }
  const legacyPosition = request.notes?.match(ROTATION_ORIGIN_PATTERN)?.[1];
  if (legacyPosition) return { type: 'vehicle', position: Number(legacyPosition) };
  return { type: 'unknown', position: null };
}

export function newExecutionItem(request: RequestedMovement): ExecutionItem {
  const origin = entryOrigin(request);
  const condition = TIRE_CONDITIONS.has(request.condition ?? '')
    ? request.condition as ExecutionItem['condition']
    : 'N';
  return {
    id: crypto.randomUUID(),
    direction: request.direction,
    position: request.position,
    reason: request.direction === 'exit' ? (request.reason ?? '') : '',
    code: request.casing_code ?? '',
    code_unreadable: false,
    brand: request.brand_name ?? '',
    size: request.size_name ?? '',
    design: request.model_name ?? '',
    rtd_min_mm: request.last_rtd_mm == null ? '' : String(request.last_rtd_mm),
    condition,
    retread_design: request.retread_design ?? '',
    observations: request.notes ?? '',
    origin_type: origin.type,
    origin_position: origin.position,
  };
}

export function draftFromOrder(order: MovementOrder): MovementDraft {
  return {
    version: 1,
    orderId: order.id,
    odometer: '',
    items: order.request_items.map(newExecutionItem),
    updatedAt: new Date().toISOString(),
  };
}

export function groupExecutionServices(items: ExecutionItem[]): ExecutionService[] {
  const groups = new Map<number, ExecutionService>();
  items.forEach((item, index) => {
    const current = groups.get(item.position) ?? {
      position: item.position,
      exitIndex: null,
      entryIndex: null,
      exit: null,
      entry: null,
    };
    if (item.direction === 'exit') {
      current.exitIndex = index;
      current.exit = item;
    } else {
      current.entryIndex = index;
      current.entry = item;
    }
    groups.set(item.position, current);
  });
  return [...groups.values()].sort((left, right) => left.position - right.position);
}

export function serviceCountFromOrder(order: Pick<MovementOrder, 'request_items'>): number {
  return new Set(order.request_items.map((item) => item.position)).size;
}

export function validateDraft(
  draft: MovementDraft,
  lastOdometer: number | null,
): string[] {
  const errors: string[] = [];
  const odometer = Number(draft.odometer);

  if (!draft.odometer.trim() || !Number.isInteger(odometer) || odometer < 0) {
    errors.push('Ingresa el kilometraje entero que marca la máquina.');
  } else if (lastOdometer !== null && odometer < lastOdometer) {
    errors.push(`El kilometraje no puede ser menor a ${lastOdometer.toLocaleString('es-PE')} km.`);
  }

  if (draft.items.length === 0) errors.push('La orden no contiene neumáticos.');

  draft.items.forEach((item, index) => {
    const row = index + 1;
    if (!Number.isInteger(item.position) || item.position <= 0) {
      errors.push(`Renglón ${row}: posición inválida.`);
    }
    if (!item.code.trim() && !item.code_unreadable) {
      errors.push(`P${item.position}: ingresa el código o marca SIN CÓDIGO LEGIBLE.`);
    }
    if (item.direction === 'exit' && !item.reason) {
      errors.push(`P${item.position}: selecciona el destino de la salida.`);
    }
    if (item.condition !== 'N' && !item.retread_design.trim()) {
      errors.push(`P${item.position}: indica el diseño de reencauche para ${item.condition}.`);
    }
    if (item.rtd_min_mm && (Number.isNaN(Number(item.rtd_min_mm)) || Number(item.rtd_min_mm) < 0)) {
      errors.push(`P${item.position}: RTD mínimo inválido.`);
    }
  });

  return errors;
}

export function draftStorageKey(userId: string, companyId: string, orderId: string): string {
  return `renova:movements:draft:v1:${userId}:${companyId}:${orderId}`;
}
