import { inspeccionRepo } from '../db/repos/inspeccionRepo';
import { unidadRepo } from '../db/repos/unidadRepo';
import { empresaRepo } from '../db/repos/empresaRepo';
import { listInspeccionesPorPlaca, type UnidadPreloadRow } from './readInspecciones';

// Fallback SOLO si el servidor no devolvió vehicle_type/notation (no debería pasar:
// ambas columnas son NOT NULL en units/vehicle_configs). Antes de task_15 esto era
// el camino normal (adivinar); ahora es una red de seguridad, con warning.
function inferConfigFallback(rows: UnidadPreloadRow[]): string {
  const maxPos = Math.max(0, ...rows.map(r => r.position_number));
  if (maxPos >= 8) return '2-4-2';
  if (maxPos >= 6) return '2-4';
  return '2-2';
}

export async function preloadUnidadFromSupabase(empresaId: string, plate: string): Promise<boolean> {
  // Resolvemos el nombre de empresa (Supabase indexa por company_name, no por el
  // slug local). Funciona para cualquier empresa, no solo MÓVIL BUS.
  const empresa = await empresaRepo.getById(empresaId);
  if (!empresa) return false;

  const rows = await listInspeccionesPorPlaca(empresa.nombre, plate);
  if (!rows.length) return false;

  const latestDate = rows[0].inspected_on;
  const latestRows = rows.filter(r => r.inspected_on === latestDate);
  const head = latestRows[0];
  const odometer = Number(head.odometer_km ?? 0);

  let tipoVehiculo = head.vehicle_type;
  let config = head.notation;
  if (!tipoVehiculo || !config) {
    console.warn(
      `preloadUnidadFromSupabase: servidor no devolvió vehicle_type/notation para ${plate} — usando fallback adivinado`
    );
    tipoVehiculo = tipoVehiculo ?? 'BUS';
    config = config ?? inferConfigFallback(latestRows);
  }

  await unidadRepo.upsert({
    numero: head.plate,
    empresa_id: empresaId,
    tipo_vehiculo: tipoVehiculo,
    configuracion: config,
    odometro_ultimo: odometer,
    ultima_fecha: latestDate,
  });

  const existing = await unidadRepo.getUltimaCabecera(empresaId, head.plate);
  if (existing && existing.fecha === latestDate) return true;

  const cabecera = await inspeccionRepo.crearCabecera(
    empresaId,
    head.plate,
    latestDate,
    odometer,
    head.unit_photo_url ?? null
  );

  for (const row of latestRows) {
    await inspeccionRepo.upsertNeumatico({
      empresa_id: empresaId,
      cabecera_id: cabecera.id,
      posicion: row.position_number,
      codigo: row.tire_code ?? row.casing_code,
      marca: row.brand_name,
      modelo: null,
      condicion: row.condition,
      reencauche: row.retread_design,
      medida: row.size_name,
      r1: row.rtd_a_mm,
      r2: row.rtd_b_mm,
      r3: row.rtd_c_mm,
      r4: row.rtd_d_mm,
      presion: row.pressure_psi,
      tapa_valvula: row.valve_cap,
      anomalia: row.anomaly,
    });
  }

  return true;
}
