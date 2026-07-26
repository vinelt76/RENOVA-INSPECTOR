import { describe, expect, it } from 'vitest';
import {
  draftFromOrder,
  groupExecutionServices,
  loginIdentifierCandidates,
  loginIdentifierToEmail,
  serviceCountFromOrder,
  validateDraft,
} from './model';
import type { MovementOrder } from './types';

function order(): MovementOrder {
  return {
    id: 'order-1', company_id: 'company-1', company_name: 'MÓVIL BUS', unit_id: 'unit-1',
    plate: '7404', last_odometer: 100_000, vehicle_config: '2-4', requested_by: 'sup-1',
    requested_by_name: 'Supervisor', assigned_to: null, assigned_to_name: null, status: 'issued',
    scheduled_for: '2026-07-20', instructions: null, requested_items_count: 2,
    request_items: [
      { direction: 'exit', position: 3, reason: 'retention' },
      {
        direction: 'entry',
        position: 3,
        origin_type: 'inventory',
        life_cycle_id: 'life-1',
        casing_code: 'RET-101',
        brand_name: 'MICHELIN',
        model_name: 'X MULTI',
        size_name: '295/80R22.5',
        condition: 'R1',
        retread_design: 'BANDA-A',
        last_rtd_mm: 14.5,
      },
    ], issued_at: '2026-07-20T00:00:00Z', started_at: null, completed_at: null, odometer_km: null,
  };
}

describe('modelo de captura de movimientos', () => {
  it('convierte un usuario corto al correo interno sin alterar un correo real', () => {
    expect(loginIdentifierCandidates('  JROJAS ')).toEqual(['jrojas@operarios.renova.local']);
    expect(loginIdentifierToEmail('  JROJAS ')).toBe('jrojas@operarios.renova.local');
    expect(loginIdentifierToEmail('j@empresa.pe')).toBe('j@empresa.pe');
  });

  it('precarga salida e ingreso desde la orden del supervisor', () => {
    const draft = draftFromOrder(order());
    expect(draft.items).toMatchObject([
      { direction: 'exit', position: 3, reason: 'retention', origin_type: 'unknown' },
      {
        direction: 'entry',
        position: 3,
        reason: '',
        origin_type: 'inventory',
        origin_position: null,
        code: 'RET-101',
        brand: 'MICHELIN',
        size: '295/80R22.5',
        design: 'X MULTI',
        rtd_min_mm: '14.5',
        condition: 'R1',
        retread_design: 'BANDA-A',
      },
    ]);
  });

  it('agrupa la estructura técnica en un servicio por posición', () => {
    const rotation = order();
    rotation.requested_items_count = 4;
    rotation.request_items = [
      { direction: 'exit', position: 3, reason: 'rotation' },
      { direction: 'entry', position: 3, origin_type: 'vehicle', origin_position: 4 },
      { direction: 'exit', position: 4, reason: 'rotation' },
      { direction: 'entry', position: 4, origin_type: 'vehicle', origin_position: 3 },
    ];

    const draft = draftFromOrder(rotation);
    expect(groupExecutionServices(draft.items)).toMatchObject([
      {
        position: 3,
        exitIndex: 0,
        entryIndex: 1,
        entry: { origin_type: 'vehicle', origin_position: 4 },
      },
      {
        position: 4,
        exitIndex: 2,
        entryIndex: 3,
        entry: { origin_type: 'vehicle', origin_position: 3 },
      },
    ]);
    expect(serviceCountFromOrder(rotation)).toBe(2);
  });

  it('reconoce el origen de rotaciones antiguas por la nota contractual', () => {
    const legacyRotation = order();
    legacyRotation.request_items[1] = {
      direction: 'entry',
      position: 3,
      notes: 'Rotar desde P7 · intercambio',
    };

    const draft = draftFromOrder(legacyRotation);
    expect(draft.items[1]).toMatchObject({
      origin_type: 'vehicle',
      origin_position: 7,
    });
  });

  it('impide retroceder el odómetro y exige identidad/condición de reencauche', () => {
    const draft = draftFromOrder(order());
    draft.odometer = '99999';
    draft.items[0].code_unreadable = true;
    draft.items[1].code = 'ABC-1';
    draft.items[1].condition = 'R1';
    draft.items[1].retread_design = '';
    const errors = validateDraft(draft, 100_000);
    expect(errors).toContain('El kilometraje no puede ser menor a 100,000 km.');
    expect(errors).toContain('P3: indica el diseño de reencauche para R1.');
  });
});
