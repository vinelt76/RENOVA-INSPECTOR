import { describe, it, expect, vi, beforeEach } from 'vitest';

const { listCabecerasHoy, marcarSincronizada, borrarCabecera } = vi.hoisted(() => ({
  listCabecerasHoy: vi.fn(),
  marcarSincronizada: vi.fn().mockResolvedValue(undefined),
  borrarCabecera: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../db/repos/inspeccionRepo', () => ({
  inspeccionRepo: { listCabecerasHoy, marcarSincronizada, borrarCabecera },
}));

const { getByRegistro, enqueue, marcarEnviado } = vi.hoisted(() => ({
  getByRegistro: vi.fn(),
  enqueue: vi.fn().mockResolvedValue(undefined),
  marcarEnviado: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../db/repos/syncQueueRepo', () => ({
  syncQueueRepo: { getByRegistro, enqueue, marcarEnviado },
}));

const { drainSyncQueue } = vi.hoisted(() => ({ drainSyncQueue: vi.fn().mockResolvedValue({ enviadas: 0, pendientes: 0 }) }));
vi.mock('./drainQueue', () => ({ drainSyncQueue }));

const { pushInspeccionToSupabase } = vi.hoisted(() => ({ pushInspeccionToSupabase: vi.fn() }));
vi.mock('./pushInspeccion', () => ({ pushInspeccionToSupabase }));

let supabaseEnabled = true;
vi.mock('./supabaseClient', () => ({
  get supabaseEnabled() {
    return supabaseEnabled;
  },
}));

vi.mock('../db/sqlite', () => ({ localDate: () => '2026-07-11' }));

import { terminarInspeccionesDelDia } from './terminarInspeccion';

describe('terminarInspeccionesDelDia — nunca borrar sin confirmación positiva (task_17 review fix)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseEnabled = true;
    listCabecerasHoy.mockResolvedValue([{ id: 'cab1' }]);
  });

  it('borra la cabecera si la cola confirma enviado=1', async () => {
    getByRegistro.mockResolvedValue({ id: 'q1', enviado: 1, created_at: 't1' });

    const res = await terminarInspeccionesDelDia('emp1');

    expect(pushInspeccionToSupabase).not.toHaveBeenCalled();
    expect(borrarCabecera).toHaveBeenCalledWith('cab1');
    expect(res).toEqual({ ok: true, borradas: 1, pendientes: 0 });
  });

  it('NO borra una cabecera legacy sin fila en la cola si el push directo falla', async () => {
    getByRegistro.mockResolvedValue(null); // sin fila: cabecera creada antes de task_17
    pushInspeccionToSupabase.mockResolvedValue({ ok: false, error: 'network error' });

    const res = await terminarInspeccionesDelDia('emp1');

    expect(enqueue).toHaveBeenCalledWith('inspeccion_cabecera', 'cab1');
    expect(pushInspeccionToSupabase).toHaveBeenCalledWith('cab1');
    expect(borrarCabecera).not.toHaveBeenCalled();
    expect(res).toEqual({ ok: false, borradas: 0, pendientes: 1 });
  });

  it('borra una cabecera legacy sin fila en la cola SOLO tras un push directo exitoso', async () => {
    getByRegistro
      .mockResolvedValueOnce(null) // primera consulta: no había fila
      .mockResolvedValueOnce({ id: 'q1', enviado: 0, created_at: 't1' }); // tras enqueue
    pushInspeccionToSupabase.mockResolvedValue({ ok: true });

    const res = await terminarInspeccionesDelDia('emp1');

    expect(marcarEnviado).toHaveBeenCalledWith('q1', 't1');
    expect(borrarCabecera).toHaveBeenCalledWith('cab1');
    expect(res).toEqual({ ok: true, borradas: 1, pendientes: 0 });
  });

  it('NO borra si la cola tiene la fila pero aún no está enviada', async () => {
    getByRegistro.mockResolvedValue({ id: 'q1', enviado: 0, created_at: 't1' });

    const res = await terminarInspeccionesDelDia('emp1');

    expect(pushInspeccionToSupabase).not.toHaveBeenCalled();
    expect(borrarCabecera).not.toHaveBeenCalled();
    expect(res).toEqual({ ok: false, borradas: 0, pendientes: 1 });
  });
});
