// RENOVA — Config pública de Supabase para los dashboards HTML publicados
// (GitHub Pages). Segura de commitear: la anon/publishable key es pública
// por diseño de Supabase — la protección real de los datos es RLS por
// empresa, ver supabase/migrations/20260710090000_dashboard_public_rls.sql.
// Cada dashboard exige login (RenovaSupabase.requireAuth()) antes de leer.
//
// NUNCA agregar acá la service_role key.
window.RENOVA_SUPABASE = {
  url: "https://fbxupwwgiebhlciqftpw.supabase.co",
  anonKey: "sb_publishable_g9hVjkdfA1YeSaIX9dZTYg_86eLCuaU",
};
