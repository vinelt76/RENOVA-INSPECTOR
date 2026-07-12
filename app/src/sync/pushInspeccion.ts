import { supabase } from './supabaseClient';
import { inspeccionRepo } from '../db/repos/inspeccionRepo';
import { unidadRepo } from '../db/repos/unidadRepo';
import { empresaRepo } from '../db/repos/empresaRepo';

export interface PushResult {
  ok: boolean;
  /** true = no se intentó enviar porque Supabase no está configurado (sin .env) */
  skipped?: boolean;
  error?: string;
}

/**
 * Envía la inspección (cabecera + todas las posiciones) a Supabase.
 * Idempotente: se puede reintentar con la misma cabeceraId sin duplicar filas —
 * save_inspection() hace upsert por (placa, fecha) y por (inspección, posición).
 * No lanza: siempre devuelve un resultado, para no romper el flujo local si falla.
 */
export async function pushInspeccionToSupabase(cabeceraId: string): Promise<PushResult> {
  if (!supabase) return { ok: false, skipped: true };

  try {
    const cabecera = await inspeccionRepo.getCabecera(cabeceraId);
    if (!cabecera) return { ok: false, error: 'Cabecera no encontrada localmente' };

    const empresa = await empresaRepo.getById(cabecera.empresa_id);
    if (!empresa) return { ok: false, error: `Empresa local desconocida: ${cabecera.empresa_id}` };

    const unidad = await unidadRepo.getByNumero(cabecera.empresa_id, cabecera.numero_unidad);
    const neumaticos = await inspeccionRepo.listNeumaticos(cabeceraId);

    const payload = {
      // UUID generado en el dispositivo → save_inspection lo usa como id de la
      // cabecera en Supabase: reintentar el mismo push NUNCA duplica filas.
      local_id: cabecera.id,
      // El server resuelve company_id por nombre (public.companies.name).
      company_name: empresa.nombre,
      plate_number: cabecera.numero_unidad,
      inspection_date: cabecera.fecha,
      odometer_km: cabecera.km_odometro,
      vehicle_type: unidad?.tipo_vehiculo ?? null,
      configuration: unidad?.configuracion ?? null,
      // operation: sin fuente en la app hoy (auditoría §10.4) — no se envía, queda NULL
      items: neumaticos.map(n => ({
        position: String(n.posicion),
        tire_code: n.codigo,
        tire_size: n.medida,
        tire_brand: n.marca,
        original_design: n.modelo,      // "modelo" local == DISEÑO ORIGINAL del Excel
        current_design: n.reencauche,   // DISEÑO ACTUAL (reencauche)
        tire_condition: n.condicion,
        rtd_a: n.r1,
        rtd_b: n.r2,
        rtd_c: n.r3,
        rtd_d: n.r4,
        rtd_movi: n.rtd_movi,
        pressure: n.presion,
        valve_cap: n.tapa_valvula,
        not_measured: n.presion === null, // "SIN MEDIR" implícito — ver auditoría §10.1
        tire_anomaly: n.anomalia,
        // Snapshot de umbrales (task_16): el umbral vigente al momento en que SE CALCULÓ
        // esta fila, no el umbral actual de la empresa — histórico reproducible.
        rtd_for_change: n.rtd_cambio_snap,
        rtd_next_change: n.rtd_proximo_snap,
        rtd_normal: n.rtd_normal_snap,
        scrap: n.desecho === 1,
        rtd_status: n.estado_rtd,
      })),
    };

    const { error } = await supabase.rpc('save_inspection', { payload });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
