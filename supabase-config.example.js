// RENOVA — Configuración de Supabase para los dashboards HTML (desarrollo local).
//
// 1. Copiar este archivo como `supabase-config.local.js` (mismo directorio).
// 2. Completar url + anonKey con los datos del proyecto (Dashboard → Settings → API).
// 3. `supabase-config.local.js` está en .gitignore: NUNCA commitear valores reales.
//
// Sin este archivo (o con campos vacíos) los dashboards funcionan igual que
// siempre, 100% con datos mock — el fallback es automático.
//
// SOLO clave anon/publishable. NUNCA la service_role.
// RLS ya está habilitada (supabase/migrations/20260710090000_dashboard_public_rls.sql):
// cada usuario ve solo los datos de su empresa vía login (Supabase Auth).
// Para el deploy público se usa supabase-config.public.js (mismos datos, sí commiteado —
// la anon key es segura de publicar porque RLS es la protección real).
window.RENOVA_SUPABASE = {
  url: "",      // ej: https://<project-ref>.supabase.co
  anonKey: "",  // clave anon (publishable) — jamás service_role
};
