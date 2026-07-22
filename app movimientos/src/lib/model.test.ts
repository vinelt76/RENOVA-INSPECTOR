import { describe, expect, it } from 'vitest';
import { draftFromOrder, loginIdentifierToEmail, validateDraft } from './model';
import type { MovementOrder } from './types';

function order(): MovementOrder {
  return {
    id: 'order-1', company_id: 'company-1', company_name: 'MÓVIL BUS', unit_id: 'unit-1',
    plate: '7404', last_odometer: 100_000, vehicle_config: '2-4', requested_by: 'sup-1',
    requested_by_name: 'Supervisor', assigned_to: null, assigned_to_name: null, status: 'issued',
    scheduled_for: '2026-07-20', instructions: null, requested_items_count: 2,
    request_items: [
      { direction: 'exit', position: 3, reason: 'retention' },
      { direction: 'entry', position: 3 },
    ], issued_at: '2026-07-20T00:00:00Z', started_at: null, completed_at: null, odometer_km: null,
  };
}

describe('modelo de captura de movimientos', () => {
  it('convierte un usuario corto al correo interno sin alterar un correo real', () => {
    expect(loginIdentifierToEmail('  JROJAS ')).toBe('jrojas@operarios.renova.local');
    expect(loginIdentifierToEmail('j@empresa.pe')).toBe('j@empresa.pe');
  });

  it('precarga salida e ingreso desde la orden del supervisor', () => {
    const draft = draftFromOrder(order());
    expect(draft.items).toMatchObject([
      { direction: 'exit', position: 3, reason: 'retention' },
      { direction: 'entry', position: 3, reason: '' },
    ]);
  });

  it('impide retroceder el odómetro y exige identidad/condición de reencauche', () => {
    const draft = draftFromOrder(order());
    draft.odometer = '99999';
    draft.items[0].code_unreadable = true;
    draft.items[1].code = 'ABC-1';
    draft.items[1].condition = 'R1';
    const errors = validateDraft(draft, 100_000);
    expect(errors).toContain('El kilometraje no puede ser menor a 100,000 km.');
    expect(errors).toContain('P3: indica el diseño de reencauche para R1.');
  });
});
