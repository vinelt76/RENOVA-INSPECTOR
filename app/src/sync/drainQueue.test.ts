import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SyncQueue } from '../db/schema';

const { pendientes, marcarEnviado, marcarError } = vi.hoisted(() => ({
  pendientes: vi.fn(),
  marcarEnviado: vi.fn(),
  marcarError: vi.fn(),
}));
vi.mock('../db/repos/syncQueueRepo', () => ({
  syncQueueRepo: { pendientes, marcarEnviado, marcarError },
}));

const { pushInspeccionToSupabase } = vi.hoisted(() => ({
  pushInspeccionToSupabase: vi.fn(),
}));
vi.mock('./pushInspeccion', () => ({ pushInspeccionToSupabase }));

let supabaseEnabled = true;
vi.mock('./supabaseClient', () => ({
  get supabaseEnabled() {
    return supabaseEnabled;
  },
}));

import { drainSyncQueue } from './drainQueue';

function fila(overrides: Partial<SyncQueue> = {}): SyncQueue {
  return {
    id: 'q1',
    tabla: 'inspeccion_cabecera',
    registro_id: 'cab1',
    op: 'upsert',
    created_at: '2026-07-11T00:00:00.000Z',
    enviado: 0,
    intentos: 0,
    ultimo_error: null,
    next_retry_at: null,
    ...overrides,
  };
}

describe('drainSyncQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseEnabled = true;
  });

  it('no hace nada si Supabase no está configurado', async () => {
    supabaseEnabled = false;
    const res = await drainSyncQueue();
    expect(res).toEqual({ enviadas: 0, pendientes: 0 });
    expect(pendientes).not.toHaveBeenCalled();
  });

  it('drenado exitoso marca la fila como enviada', async () => {
    pendientes.mockResolvedValue([fila()]);
    pushInspeccionToSupabase.mockResolvedValue({ ok: true });

    const res = await drainSyncQueue();

    expect(pushInspeccionToSupabase).toHaveBeenCalledWith('cab1');
    expect(marcarEnviado).toHaveBeenCalledWith('q1', '2026-07-11T00:00:00.000Z');
    expect(marcarError).not.toHaveBeenCalled();
    expect(res).toEqual({ enviadas: 1, pendientes: 0 });
  });

  it('drenado con fallo incrementa intentos y calcula backoff exponencial', async () => {
    pendientes.mockResolvedValue([fila({ intentos: 2 })]);
    pushInspeccionToSupabase.mockResolvedValue({ ok: false, error: 'network error' });

    const before = Date.now();
    const res = await drainSyncQueue();
    const after = Date.now();

    expect(marcarEnviado).not.toHaveBeenCalled();
    expect(marcarError).toHaveBeenCalledTimes(1);
    const [id, createdAt, intentos, error, nextRetryAt] = marcarError.mock.calls[0];
    expect(id).toBe('q1');
    expect(createdAt).toBe('2026-07-11T00:00:00.000Z');
    expect(intentos).toBe(3); // 2 + 1
    expect(error).toBe('network error');
    // backoff = 2^3 = 8s
    const expectedMs = 8 * 1000;
    const delta = new Date(nextRetryAt).getTime() - before;
    expect(delta).toBeGreaterThanOrEqual(expectedMs - 50);
    expect(delta).toBeLessThanOrEqual(after - before + expectedMs + 1000);
    expect(res).toEqual({ enviadas: 0, pendientes: 1 });
  });

  it('el backoff nunca supera el tope de 300s', async () => {
    pendientes.mockResolvedValue([fila({ intentos: 20 })]);
    pushInspeccionToSupabase.mockResolvedValue({ ok: false, error: 'boom' });

    const before = Date.now();
    await drainSyncQueue();

    const [, , , , nextRetryAt] = marcarError.mock.calls[0];
    const delta = new Date(nextRetryAt).getTime() - before;
    expect(delta).toBeLessThanOrEqual(300 * 1000 + 1000);
  });

  it('un fallo en una fila no bloquea el resto de la cola', async () => {
    pendientes.mockResolvedValue([fila({ id: 'q1', registro_id: 'cab1' }), fila({ id: 'q2', registro_id: 'cab2' })]);
    pushInspeccionToSupabase
      .mockResolvedValueOnce({ ok: false, error: 'boom' })
      .mockResolvedValueOnce({ ok: true });

    const res = await drainSyncQueue();

    expect(marcarError).toHaveBeenCalledWith('q1', '2026-07-11T00:00:00.000Z', 1, 'boom', expect.any(String));
    expect(marcarEnviado).toHaveBeenCalledWith('q2', '2026-07-11T00:00:00.000Z');
    expect(res).toEqual({ enviadas: 1, pendientes: 1 });
  });

  it('skipped no cuenta como error (no llama marcarError)', async () => {
    pendientes.mockResolvedValue([fila()]);
    pushInspeccionToSupabase.mockResolvedValue({ ok: false, skipped: true });

    const res = await drainSyncQueue();

    expect(marcarError).not.toHaveBeenCalled();
    expect(marcarEnviado).not.toHaveBeenCalled();
    expect(res).toEqual({ enviadas: 0, pendientes: 1 });
  });
});
