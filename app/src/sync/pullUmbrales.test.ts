import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getById } = vi.hoisted(() => ({ getById: vi.fn() }));
vi.mock('../db/repos/empresaRepo', () => ({ empresaRepo: { getById } }));

const { upsertRtd } = vi.hoisted(() => ({ upsertRtd: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../db/repos/umbralRepo', () => ({ umbralRepo: { upsertRtd } }));

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('./supabaseClient', () => ({ supabase: { rpc } }));

import { pullUmbrales, waitForUmbralesPendientes } from './pullUmbrales';

describe('waitForUmbralesPendientes — cierra la race con el primer guardado (task_17 review, 2026-07-11)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getById.mockResolvedValue({ id: 'emp1', nombre: 'MÓVIL BUS' });
  });

  it('resuelve al toque si no hay ningún pull en vuelo', async () => {
    const start = Date.now();
    await waitForUmbralesPendientes(3000);
    expect(Date.now() - start).toBeLessThan(50);
  });

  it('espera a que el pull en vuelo termine antes de resolver', async () => {
    let resolveRpc!: (v: { data: unknown; error: unknown }) => void;
    rpc.mockReturnValue(new Promise(res => { resolveRpc = res; }));

    const pullPromise = pullUmbrales('emp1');
    let waited = false;
    const waitPromise = waitForUmbralesPendientes(3000).then(() => { waited = true; });

    // Todavía no resolvió el RPC → el wait no debería haber terminado.
    await new Promise(r => setTimeout(r, 10));
    expect(waited).toBe(false);

    resolveRpc({ data: [{ size_name: null, rtd_change_mm: 6, rtd_next_mm: 9, rtd_removal_mm: 12 }], error: null });
    await pullPromise;
    await waitPromise;
    expect(waited).toBe(true);
    expect(upsertRtd).toHaveBeenCalledWith('emp1', '*', 6, 9, 12);
  });

  it('nunca bloquea indefinidamente: si el pull no resuelve, corta al timeout', async () => {
    rpc.mockReturnValue(new Promise(() => {})); // nunca resuelve (simula offline colgado)
    void pullUmbrales('emp1');

    const start = Date.now();
    await waitForUmbralesPendientes(50);
    expect(Date.now() - start).toBeLessThan(200);
  });

  it('un pull que falla no deja el wait colgado para el siguiente guardado', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'network error' } });
    await pullUmbrales('emp1');

    const start = Date.now();
    await waitForUmbralesPendientes(3000);
    expect(Date.now() - start).toBeLessThan(50);
  });
});
