import { supabase } from './supabaseClient';
import { empresaRepo } from '../db/repos/empresaRepo';
import { umbralRepo } from '../db/repos/umbralRepo';

// Pull de umbrales RTD desde Supabase (rtd_thresholds, vía RPC get_umbrales_rtd) al
// seleccionar empresa. size_name NULL en el servidor = default de la empresa para
// toda medida → se guarda local como medida='*' (mismo criterio que la siembra de
// la migración v3). Sin red o sin `.env`, la app sigue usando lo ya sembrado/local
// — nunca bloquea la selección de empresa.

interface UmbralRow {
  size_name: string | null;
  rtd_change_mm: number;
  rtd_next_mm: number;
  rtd_removal_mm: number | null;
}

// Pull en vuelo (si hay uno). AppContext.setEmpresa dispara pullUmbrales() sin
// esperarlo (no bloquea la navegación), así que un inspector rápido puede llegar
// a la pantalla de inspección y guardar el primer neumático antes de que este RPC
// resuelva — ese guardado snapshotearía el umbral sembrado (4/7/8) en vez del real
// de la empresa (race detectada en code review de task_17, 2026-07-11).
// waitForUmbralesPendientes() lo cierra sin bloquear nada por sí solo: la UI sigue
// libre de navegar; solo el guardado real (inspeccionRepo.upsertNeumatico, vía
// InspeccionScreen.commit) espera este pull puntual, con tope de tiempo.
let inFlight: Promise<unknown> | null = null;

export async function waitForUmbralesPendientes(timeoutMs = 3000): Promise<void> {
  if (!inFlight) return;
  await Promise.race([
    inFlight.catch(() => undefined),
    new Promise<void>(resolve => setTimeout(resolve, timeoutMs)),
  ]);
}

export async function pullUmbrales(empresaId: string): Promise<{ ok: boolean; actualizados: number; error?: string }> {
  if (!supabase) return { ok: false, actualizados: 0, error: 'Supabase no configurado' };

  const run = ejecutarPull(supabase, empresaId);
  inFlight = run;
  try {
    return await run;
  } finally {
    if (inFlight === run) inFlight = null;
  }
}

async function ejecutarPull(
  client: NonNullable<typeof supabase>,
  empresaId: string
): Promise<{ ok: boolean; actualizados: number; error?: string }> {
  try {
    const empresa = await empresaRepo.getById(empresaId);
    if (!empresa) return { ok: false, actualizados: 0, error: `Empresa local desconocida: ${empresaId}` };

    const { data, error } = await client.rpc('get_umbrales_rtd', { p_company_name: empresa.nombre });
    if (error) return { ok: false, actualizados: 0, error: error.message };

    const rows = (data ?? []) as UmbralRow[];
    let actualizados = 0;
    for (const row of rows) {
      const medida = row.size_name ?? '*';
      const rtdNormal = row.rtd_removal_mm ?? row.rtd_next_mm;
      await umbralRepo.upsertRtd(empresaId, medida, row.rtd_change_mm, row.rtd_next_mm, rtdNormal);
      actualizados++;
    }
    return { ok: true, actualizados };
  } catch (e) {
    return { ok: false, actualizados: 0, error: e instanceof Error ? e.message : String(e) };
  }
}
