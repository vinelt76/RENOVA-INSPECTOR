import { syncQueueRepo } from '../db/repos/syncQueueRepo';
import { pushInspeccionToSupabase } from './pushInspeccion';
import { supabase } from './supabaseClient';

const MAX_BACKOFF_SEC = 300;

export interface DrainResult {
  enviadas: number;
  pendientes: number;
}

// Drena sync_queue solo bajo una sesión autenticada. Las inspecciones nuevas
// permanecen locales hasta que un inspector inicie sesión; la clave pública no
// debe autorizar sincronizaciones ni siquiera durante el arranque de la app.
export async function drainSyncQueue(): Promise<DrainResult> {
  if (!supabase) return { enviadas: 0, pendientes: 0 };

  let sessionUserId: string | null = null;
  try {
    const { data, error } = await supabase.auth.getSession();
    sessionUserId = data.session?.user?.id ?? null;
    if (error || !sessionUserId) return { enviadas: 0, pendientes: 0 };
  } catch {
    // No convertir fallos locales de sesión en errores de cola ni descartar datos.
    return { enviadas: 0, pendientes: 0 };
  }

  const rows = await syncQueueRepo.pendientes();
  let enviadas = 0;
  let pendientes = 0;

  for (const row of rows) {
    const res = await pushInspeccionToSupabase(row.registro_id, sessionUserId);
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
