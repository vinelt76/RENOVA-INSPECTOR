import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getSession, rpc } = vi.hoisted(() => ({
  getSession: vi.fn(),
  rpc: vi.fn(),
}));
const { getCabecera, listNeumaticos } = vi.hoisted(() => ({
  getCabecera: vi.fn(),
  listNeumaticos: vi.fn(),
}));
const { getById } = vi.hoisted(() => ({ getById: vi.fn() }));
const { getByNumero } = vi.hoisted(() => ({ getByNumero: vi.fn() }));

vi.mock('./supabaseClient', () => ({
  supabase: { auth: { getSession }, rpc },
}));
vi.mock('../db/repos/inspeccionRepo', () => ({
  inspeccionRepo: { getCabecera, listNeumaticos },
}));
vi.mock('../db/repos/empresaRepo', () => ({ empresaRepo: { getById } }));
vi.mock('../db/repos/unidadRepo', () => ({ unidadRepo: { getByNumero } }));

import { pushInspeccionToSupabase } from './pushInspeccion';

function session(id: string) {
  return { data: { session: { user: { id } } }, error: null };
}

function cabecera(owner: string | null) {
  return {
    id: 'cab-1',
    empresa_id: 'empresa-1',
    numero_unidad: '225',
    fecha: '2026-09-26',
    km_odometro: 1000,
    foto_unidad: null,
    captured_by_user_id: owner,
    created_at: '2026-09-26T00:00:00.000Z',
    updated_at: '2026-09-26T00:00:00.000Z',
    sincronizado: 0,
  };
}

describe('pushInspeccionToSupabase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue(session('inspector-a'));
    getCabecera.mockResolvedValue(cabecera('inspector-a'));
    getById.mockResolvedValue({ nombre: 'Empresa A' });
    getByNumero.mockResolvedValue({ tipo_vehiculo: 'BUS', configuracion: '2-4-2' });
    listNeumaticos.mockResolvedValue([]);
    rpc.mockResolvedValue({ error: null });
  });

  it('conserva la cola si otra cuenta inició sesión después de la captura', async () => {
    getCabecera.mockResolvedValue(cabecera('inspector-a'));
    getSession.mockResolvedValue(session('inspector-b'));

    const result = await pushInspeccionToSupabase('cab-1', 'inspector-b');

    expect(result).toMatchObject({ ok: false, skipped: true });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('envía el UID de captura solo con la misma sesión', async () => {
    const result = await pushInspeccionToSupabase('cab-1', 'inspector-a');

    expect(result).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith('save_inspection', {
      payload: expect.objectContaining({ captured_by_user_id: 'inspector-a' }),
    });
  });
});
