import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Integración mínima (demo): sin estas dos variables la app funciona 100% local,
// exactamente igual que hoy — ver app/.env.example. Nombres con prefijo VITE_
// porque Vite solo expone al bundle del cliente las env vars con ese prefijo
// (SUPABASE_URL / SUPABASE_ANON_KEY a secas no llegarían al navegador).
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

export const supabaseEnabled = supabase !== null;
