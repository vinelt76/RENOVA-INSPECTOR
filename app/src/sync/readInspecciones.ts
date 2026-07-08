import { supabase } from './supabaseClient';

export interface InspeccionSupabase {
  id: string;
  vehicle_id: string | null;
  plate_number: string;
  inspection_date: string;
  inspection_month: string | null;
  odometer_km: number | null;
  source: string;
  sync_status: string;
  created_at: string;
  updated_at: string;
}

export interface InspeccionItemSupabase {
  id: string;
  inspection_id: string;
  position: string;
  tire_code: string | null;
  tire_size: string | null;
  tire_brand: string | null;
  original_design: string | null;
  current_design: string | null;
  tire_condition: string | null;
  rtd_a: number | null;
  rtd_b: number | null;
  rtd_c: number | null;
  rtd_d: number | null;
  rtd_movi: number | null;
  pressure: number | null;
  valve_cap: string | null;
  not_measured: boolean;
  tire_anomaly: string | null;
  scrap: boolean | null;
  rtd_status: string | null;
}

// Lectura mínima — sin RLS/auth todavía (fuera de alcance de esta fase). Pensada
// para alimentar una futura vista de inspecciones, o para probarse a mano desde
// la consola/SQL Editor de Supabase mientras esa vista no exista.

export async function listInspeccionesRecientes(limit = 20): Promise<InspeccionSupabase[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('inspections')
    .select('*')
    .order('inspection_date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function listInspeccionesPorPlaca(plate: string): Promise<InspeccionSupabase[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('inspections')
    .select('*')
    .eq('plate_number', plate)
    .order('inspection_date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getInspeccionDetalle(
  inspectionId: string
): Promise<{ cabecera: InspeccionSupabase; items: InspeccionItemSupabase[] } | null> {
  if (!supabase) return null;
  const { data: cabecera, error: e1 } = await supabase
    .from('inspections').select('*').eq('id', inspectionId).single();
  if (e1) throw e1;
  const { data: items, error: e2 } = await supabase
    .from('inspection_items').select('*').eq('inspection_id', inspectionId).order('position');
  if (e2) throw e2;
  return { cabecera, items: items ?? [] };
}
