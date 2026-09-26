import { describe, it, expect, vi, beforeEach } from 'vitest';

const { query, run } = vi.hoisted(() => ({
  query: vi.fn().mockResolvedValue({ values: [] }),
  run: vi.fn().mockResolvedValue(undefined),
}));
const { getDb, persistDb, generateId, nowIso } = vi.hoisted(() => ({
  getDb: vi.fn().mockResolvedValue({ query, run }),
  persistDb: vi.fn().mockResolvedValue(undefined),
  generateId: vi.fn(() => 'generated-id'),
  nowIso: vi.fn(() => '2026-07-11T00:00:00.000Z'),
}));
vi.mock('../sqlite', () => ({ getDb, persistDb, generateId, nowIso }));

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock('../../sync/supabaseClient', () => ({
  supabase: { auth: { getSession } },
}));

const { getRtd } = vi.hoisted(() => ({
  getRtd: vi.fn().mockResolvedValue({ empresa_id: 'emp1', medida: '*', rtd_cambio: 4, rtd_proximo: 7, rtd_normal: 8 }),
}));
vi.mock('./umbralRepo', () => ({ umbralRepo: { getRtd } }));

const { enqueue } = vi.hoisted(() => ({ enqueue: vi.fn().mockResolvedValue(undefined) }));
vi.mock('./syncQueueRepo', () => ({ syncQueueRepo: { enqueue } }));

import { inspeccionRepo } from './inspeccionRepo';

describe('inspeccionRepo — encolado en sync_queue (task_17)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    query.mockImplementation(async (sql: string) =>
      sql.includes('captured_by_user_id')
        ? { values: [{ captured_by_user_id: 'inspector-a' }] }
        : { values: [] },
    );
    getSession.mockResolvedValue({ data: { session: { user: { id: 'inspector-a' } } }, error: null });
  });

  it('crearCabecera encola la cabecera nueva', async () => {
    const cabecera = await inspeccionRepo.crearCabecera('emp1', '1234', '2026-07-11', 50000);
    expect(cabecera.captured_by_user_id).toBe('inspector-a');
    expect(run.mock.calls[0][0]).toContain('captured_by_user_id');
    expect(enqueue).toHaveBeenCalledWith('inspeccion_cabecera', 'generated-id');
  });

  it('actualizarCabecera reencola la cabecera existente', async () => {
    await inspeccionRepo.actualizarCabecera('cab1', 51000);
    expect(enqueue).toHaveBeenCalledWith('inspeccion_cabecera', 'cab1');
  });

  it('no permite editar una cabecera creada bajo otra sesión', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'inspector-b' } } }, error: null });

    await expect(inspeccionRepo.actualizarCabecera('cab1', 51000))
      .rejects.toThrow('pertenece a otra sesión');
    expect(run).not.toHaveBeenCalled();
  });

  it('upsertNeumatico encola la cabecera dueña de la posición, no el neumático', async () => {
    await inspeccionRepo.upsertNeumatico({
      empresa_id: 'emp1',
      cabecera_id: 'cab1',
      posicion: 1,
      r1: 5, r2: 6, r3: 7,
    });

    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith('inspeccion_cabecera', 'cab1');
  });

  it('borrarCabecera saca la cabecera de la cola en vez de dejar reintentos zombis', async () => {
    await inspeccionRepo.borrarCabecera('cab1');
    expect(run).toHaveBeenCalledWith(
      'DELETE FROM sync_queue WHERE tabla = ? AND registro_id = ?',
      ['inspeccion_cabecera', 'cab1']
    );
  });
});
