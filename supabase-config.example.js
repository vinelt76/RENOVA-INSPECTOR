// RENOVA — Configuración de Supabase para los dashboards HTML (DEMO local).
//
// 1. Copiar este archivo como `supabase-config.local.js` (mismo directorio).
// 2. Completar url + anonKey con los datos del proyecto (Dashboard → Settings → API).
// 3. `supabase-config.local.js` está en .gitignore: NUNCA commitear valores reales.
//
// Sin este archivo (o con campos vacíos) los dashboards funcionan igual que
// siempre, 100% con datos mock — el fallback es automático.
//
// SOLO clave anon/publishable. NUNCA la service_role.
// RLS todavía NO está habilitado: esto es únicamente para demo privada/local.
// No desplegar públicamente hasta habilitar RLS.
window.RENOVA_SUPABASE = {
  url: "",      // ej: https://<project-ref>.supabase.co
  anonKey: "",  // clave anon (publishable) — jamás service_role
};
