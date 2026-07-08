/* RENOVA — helper de orden de carga: supabase-demo.js se carga como
   type="module" (diferido) para poder importar supabase-js, así que puede
   terminar de ejecutarse DESPUÉS del <script> clásico de cada dashboard.
   window.onRenovaSupabaseReady(fn) llama fn() de inmediato si
   window.RenovaSupabase ya existe, o espera el evento "renova-supabase-ready"
   si todavía no. Cargar este script ANTES de supabase-demo.js. */
window.onRenovaSupabaseReady = function (fn) {
  if (window.RenovaSupabase) {
    fn();
  } else {
    window.addEventListener("renova-supabase-ready", fn, { once: true });
  }
};
