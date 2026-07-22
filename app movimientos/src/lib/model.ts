import type {
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

export function newExecutionItem(request: RequestedMovement): ExecutionItem {
  return {
    id: crypto.randomUUID(),
    direction: request.direction,
    position: request.position,
    reason: request.direction === 'exit' ? (request.reason ?? '') : '',
    code: '',
    code_unreadable: false,
    brand: '',
    size: '',
    design: '',
    rtd_min_mm: '',
    condition: 'N',
    retread_design: '',
    observations: request.notes ?? '',
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
