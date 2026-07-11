import { inspeccionRepo } from '../db/repos/inspeccionRepo';
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
// Supabase (se pushean en vivo durante la captura). Este botón hace un
// re-push de seguridad de CADA inspección de hoy y, SOLO si el servidor la
// confirma, borra la copia local (cabecera + neumáticos). La nube pasa a ser
// la fuente de verdad; lo que no se pudo subir se conserva intacto.
//
// save_inspection() es idempotente (upsert por local_id), así que re-pushear
// algo ya subido no duplica nada. Es la garantía que hace seguro borrar.
export async function terminarInspeccionesDelDia(empresaId: string): Promise<TerminarResult> {
  if (!supabaseEnabled) {
    return { ok: false, borradas: 0, pendientes: 0, error: 'Supabase no configurado' };
  }

  const cabeceras = await inspeccionRepo.listCabecerasHoy(empresaId, localDate());
  let borradas = 0;
  let pendientes = 0;

  for (const cab of cabeceras) {
    const res = await pushInspeccionToSupabase(cab.id);
    if (res.ok) {
      await inspeccionRepo.marcarSincronizada(cab.id);
      await inspeccionRepo.borrarCabecera(cab.id);
      borradas++;
    } else {
      pendientes++;
    }
  }

  return { ok: pendientes === 0, borradas, pendientes };
}
