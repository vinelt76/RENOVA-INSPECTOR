import { inspeccionRepo } from '../db/repos/inspeccionRepo';
import { syncQueueRepo } from '../db/repos/syncQueueRepo';
import { drainSyncQueue } from './drainQueue';
import { pushInspeccionToSupabase } from './pushInspeccion';
import { supabaseEnabled } from './supabaseClient';
import { localDate } from '../db/sqlite';

export interface TerminarResult {
  ok: boolean;
  /** Cabeceras borradas localmente (confirmadas en la nube) */
  borradas: number;
  /** Cabeceras que NO se pudieron subir → se conservan localmente */
  pendientes: number;
  error?: string;
}

// Cierre de la jornada de inspección para una empresa.
//
// Flujo (pedido por Facundo): al terminar el día, las inspecciones ya están en
// Supabase (se pushean en vivo durante la captura vía sync_queue + drainer,
// task_17). Este botón fuerza un drenado inmediato de seguridad y, SOLO si hay
// confirmación positiva de envío para una cabecera (fila en cola con
// enviado=1, o un push directo exitoso para las que no tenían fila — ver
// abajo), borra su copia local (cabecera + neumáticos). La nube pasa a ser la
// fuente de verdad; lo que no se pudo confirmar se conserva intacto (queda en
// la cola para el próximo drenado automático).
export async function terminarInspeccionesDelDia(empresaId: string): Promise<TerminarResult> {
  if (!supabaseEnabled) {
    return { ok: false, borradas: 0, pendientes: 0, error: 'Supabase no configurado' };
  }

  await drainSyncQueue();

  const cabeceras = await inspeccionRepo.listCabecerasHoy(empresaId, localDate());
  let borradas = 0;
  let pendientes = 0;

  for (const cab of cabeceras) {
    const cola = await syncQueueRepo.getByRegistro('inspeccion_cabecera', cab.id);
    let confirmado = cola?.enviado === 1;

    if (!cola) {
      // Sin fila en sync_queue: NUNCA asumir que ya está sincronizada solo por
      // eso — puede ser una cabecera legacy (creada antes de task_17, que nunca
      // encoló nada) que jamás llegó a Supabase. Forzar un push directo ahora
      // y encolarla, para que quede registrada de cara al próximo drenado si
      // este intento también falla.
      await syncQueueRepo.enqueue('inspeccion_cabecera', cab.id);
      const res = await pushInspeccionToSupabase(cab.id);
      if (res.ok) {
        const row = await syncQueueRepo.getByRegistro('inspeccion_cabecera', cab.id);
        if (row) await syncQueueRepo.marcarEnviado(row.id, row.created_at);
        confirmado = true;
      }
    }

    if (confirmado) {
      await inspeccionRepo.marcarSincronizada(cab.id);
      await inspeccionRepo.borrarCabecera(cab.id);
      borradas++;
    } else {
      pendientes++;
    }
  }

  return { ok: pendientes === 0, borradas, pendientes };
}
