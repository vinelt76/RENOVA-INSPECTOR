import { supabase } from './supabaseClient';

// listInspeccionesPorPlaca usa get_unidad_preload() (RPC SECURITY DEFINER,
// supabase/migrations/20260711000000_preload_rpc_vehicle_metadata.sql) en vez de leer
// v_inspection_dashboard_rows directo: desde que RLS quedó activa
// (20260710090000_dashboard_public_rls.sql) esa vista solo es legible por
// `authenticated` con profiles, y la app móvil todavía lee como `anon` sin
// sesión (no tiene login de inspector — eso es tasks_opencode/task_14, aparte).
// El RPC expone el mismo shape acotado a UNA placa de UNA empresa puntual.
//
// listInspeccionesRecientes SIGUE sin consumidores y SIGUE bloqueada por RLS
// (trae "todas las inspecciones", no tiene un RPC acotado equivalente — no
// se le hizo uno porque nada la usa hoy).

export interface InspeccionDashboardRow {
  company_id: string;
  company_name: string | null;
  unit_id: string;
  plate: string;
  inspection_id: string;
  inspected_on: string;
  odometer_km: number | null;
  unit_photo_url: string | null;
  position_number: number;
  side: string | null;
  axle_number: number | null;
  axle_type: string | null;
  /** Código observado en la inspección — NULL si era N/V (no visible) */
  tire_code: string | null;
  casing_code: string | null;
  code_status: string | null;
  brand_name: string | null;
  size_name: string | null;
  condition: string | null;
  retread_design: string | null;
  rtd_a_mm: number | null;
  rtd_b_mm: number | null;
  rtd_c_mm: number | null;
  rtd_d_mm: number | null;
  rtd_movi_mm: number | null;
  rtd_state: string | null;
  pressure_psi: number | null;
  pressure_state: string | null;
  valve_cap: string | null;
  anomaly: string | null;
  anomaly_photo_url: string | null;
  is_discard: boolean | null;
  inspector_name: string | null;
  updated_at: string;
}

export async function listInspeccionesRecientes(limit = 200): Promise<InspeccionDashboardRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('v_inspection_dashboard_rows')
    .select('*')
    .order('inspected_on', { ascending: false })
    .order('position_number', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/** Shape acotado que devuelve get_unidad_preload() — subconjunto de InspeccionDashboardRow. */
export interface UnidadPreloadRow {
  plate: string;
  inspected_on: string;
  odometer_km: number | null;
  unit_photo_url: string | null;
  /** Real, desde units.vehicle_type — task_15. */
  vehicle_type: string | null;
  /** Real, desde vehicle_configs.notation — task_15. */
  notation: string | null;
  position_number: number;
  tire_code: string | null;
  casing_code: string | null;
  brand_name: string | null;
  condition: string | null;
  retread_design: string | null;
  size_name: string | null;
  rtd_a_mm: number | null;
  rtd_b_mm: number | null;
  rtd_c_mm: number | null;
  rtd_d_mm: number | null;
  pressure_psi: number | null;
  valve_cap: string | null;
  anomaly: string | null;
}

export async function listInspeccionesPorPlaca(
  companyName: string,
  plate: string,
): Promise<UnidadPreloadRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('get_unidad_preload', {
    p_company_name: companyName,
    p_plate: plate,
  });
  if (error) throw error;
  return data ?? [];
}
