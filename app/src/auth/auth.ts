import type { User } from '@supabase/supabase-js';
import { supabase } from '../sync/supabaseClient';

export interface InspectorCompany {
  id: string;
  name: string;
  legacy_code: string | null;
}

export interface InspectorProfile {
  id: string;
  full_name: string;
  role: string;
  active: boolean;
  company: InspectorCompany;
}

export function assertInspectorProfile(profile: InspectorProfile): InspectorProfile {
  if (!profile.active) throw new Error('La cuenta está inactiva.');
  if (profile.role !== 'inspector') throw new Error('Esta cuenta no tiene rol de inspector.');
  if (!profile.company?.name) throw new Error('La cuenta no tiene una empresa asignada.');
  return profile;
}

function requireSupabase() {
  if (!supabase) throw new Error('La aplicación no tiene conexión con Supabase configurada.');
  return supabase;
}

export async function loadInspectorProfile(userId: string): Promise<InspectorProfile> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('profiles')
    .select('id,full_name,role,active,company:companies(id,name,legacy_code)')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('No existe un perfil operativo para esta cuenta.');
  const raw = data as Omit<InspectorProfile, 'company'> & { company: InspectorCompany | InspectorCompany[] | null };
  const company = Array.isArray(raw.company) ? raw.company[0] : raw.company;
  return assertInspectorProfile({ ...raw, company: company as InspectorCompany });
}

export async function signInInspector(email: string, password: string): Promise<User> {
  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw error;
  if (!data.user) throw new Error('Supabase no devolvió una sesión válida.');
  await loadInspectorProfile(data.user.id);
  return data.user;
}

export async function signOutInspector(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
