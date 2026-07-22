import { createClient } from '@supabase/supabase-js';
import type { MovementDraft, MovementOrder, OperatorProfile } from './types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  ?? import.meta.env.VITE_SUPABASE_ANON_KEY
) as string | undefined;

export const supabase = url && publishableKey
  ? createClient(url, publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  : null;

export async function loadOperatorProfile(userId: string): Promise<OperatorProfile> {
  if (!supabase) throw new Error('La app no tiene configurada la conexión a RENOVA.');

  const { data, error } = await supabase
    .from('profiles')
    .select('id,company_id,full_name,role,active,companies!inner(name)')
    .eq('id', userId)
    .single();

  if (error) throw error;
  const company = data.companies as unknown as { name: string };
  return {
    id: data.id,
    company_id: data.company_id,
    full_name: data.full_name,
    role: data.role,
    active: data.active,
    company_name: company.name,
  } as OperatorProfile;
}

export async function loadMovementOrders(): Promise<MovementOrder[]> {
  if (!supabase) throw new Error('La app no tiene configurada la conexión a RENOVA.');
  const { data, error } = await supabase
    .from('v_operator_movement_orders')
    .select('*')
    .in('status', ['issued', 'in_progress', 'completed'])
    .order('scheduled_for', { ascending: true })
    .order('issued_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data ?? []) as MovementOrder[];
}

export async function claimMovementOrder(orderId: string): Promise<void> {
  if (!supabase) throw new Error('La app no tiene configurada la conexión a RENOVA.');
  const { error } = await supabase.rpc('claim_tire_movement_order', { p_order_id: orderId });
  if (error) throw error;
}

export async function completeMovementOrder(draft: MovementDraft): Promise<void> {
  if (!supabase) throw new Error('La app no tiene configurada la conexión a RENOVA.');
  const { error } = await supabase.rpc('complete_tire_movement_order', {
    p_order_id: draft.orderId,
    p_odometer_km: Number(draft.odometer),
    p_items: draft.items,
  });
  if (error) throw error;
}
