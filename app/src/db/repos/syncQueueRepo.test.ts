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

import { syncQueueRepo } from './syncQueueRepo';

describe('syncQueueRepo — guard contra push en vuelo con edición nueva (race del task_17 review)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marcarEnviado condiciona el UPDATE al created_at leído antes del push', async () => {
    await syncQueueRepo.marcarEnviado('q1', '2026-07-11T00:00:00.000Z');

    expect(run).toHaveBeenCalledWith(
      expect.stringContaining('WHERE id = ? AND created_at = ? AND enviado = 0'),
      ['q1', '2026-07-11T00:00:00.000Z']
    );
  });

  it('marcarError condiciona el UPDATE al mismo created_at', async () => {
    await syncQueueRepo.marcarError('q1', '2026-07-11T00:00:00.000Z', 2, 'timeout', '2026-07-11T00:00:10.000Z');

    expect(run).toHaveBeenCalledWith(
      expect.stringContaining('WHERE id = ? AND created_at = ? AND enviado = 0'),
      [2, 'timeout', '2026-07-11T00:00:10.000Z', 'q1', '2026-07-11T00:00:00.000Z']
    );
  });

  it('enqueue reescribe created_at en cada llamada (rearma la fila) manteniendo el mismo id de conflicto', async () => {
    await syncQueueRepo.enqueue('inspeccion_cabecera', 'cab1');

    expect(run).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT(tabla, registro_id) DO UPDATE SET'),
      expect.arrayContaining(['generated-id', 'inspeccion_cabecera', 'cab1', 'upsert', '2026-07-11T00:00:00.000Z'])
    );
    // La query de conflicto resetea created_at = excluded.created_at → una edición
    // que llega mientras un push viejo está en vuelo invalida el guard de arriba
    // porque el created_at capturado antes del push ya no matchea el de la fila.
    expect(run.mock.calls[0][0]).toContain('created_at = excluded.created_at');
  });
});
