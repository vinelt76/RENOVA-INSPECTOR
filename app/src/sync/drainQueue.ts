import { syncQueueRepo } from '../db/repos/syncQueueRepo';
import { pushInspeccionToSupabase } from './pushInspeccion';
import { supabaseEnabled } from './supabaseClient';

const MAX_BACKOFF_SEC = 300;

export interface DrainResult {
  enviadas: number;
  pendientes: number;
}

// Drena sync_queue: reintenta cada fila pendiente (enviado=0, next_retry_at vencido)
// contra pushInspeccionToSupabase (ya idempotente por upsert en save_inspection). Un
// fallo en una fila no bloquea al resto — se procesan de forma aislada. Reintento con
// backoff exponencial simple (2^intentos segundos, tope 300s).
export async function drainSyncQueue(): Promise<DrainResult> {
  if (!supabaseEnabled) return { enviadas: 0, pendientes: 0 };

  const rows = await syncQueueRepo.pendientes();
  let enviadas = 0;
  let pendientes = 0;

  for (const row of rows) {
    const res = await pushInspeccionToSupabase(row.registro_id);
    if (res.ok) {
      await syncQueueRepo.marcarEnviado(row.id, row.created_at);
      enviadas++;
    } else if (res.skipped) {
      // Supabase no configurado — no cuenta como error, solo queda pendiente.
      pendientes++;
    } else {
      const intentos = row.intentos + 1;
      const backoffSec = Math.min(2 ** intentos, MAX_BACKOFF_SEC);
      const nextRetryAt = new Date(Date.now() + backoffSec * 1000).toISOString();
      await syncQueueRepo.marcarError(row.id, row.created_at, intentos, res.error ?? 'error desconocido', nextRetryAt);
      pendientes++;
    }
  }

  return { enviadas, pendientes };
}
