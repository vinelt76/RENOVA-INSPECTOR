import { supabase } from './supabaseClient';

// Lectura mínima — sin RLS/auth todavía (fuera de alcance de esta fase).
// RUN6: corregido para leer el esquema REAL del proyecto demo
// (v_inspection_dashboard_rows), no el borrador plate_number/inspection_items
// que nunca existió en el servidor. Hoy ninguna pantalla de la app lo consume:
// sirve para verificar el sync a mano y para una futura vista de inspecciones.

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

export async function listInspeccionesPorPlaca(plate: string): Promise<InspeccionDashboardRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('v_inspection_dashboard_rows')
    .select('*')
    .eq('plate', plate)
    .order('inspected_on', { ascending: false })
    .order('position_number', { ascending: true });
  if (error) throw error;
  return data ?? [];
}
