/* RENOVA — adaptador de LECTURA Supabase para los dashboards HTML (demo).
   Sin credenciales acá: la config vive en supabase-config.local.js (gitignoreado).
   Si no hay config o la red falla, cada dashboard cae solo a su dataset mock.

   API:
     RenovaSupabase.enabled                → bool (hay config)
     RenovaSupabase.fetchView(name, params) → Promise<rows>  (REST /rest/v1, GET)
     RenovaSupabase.showBadge(mode, detail) → pill fija "DATOS: …" abajo a la derecha
*/
(function () {
  "use strict";
  const cfg = window.RENOVA_SUPABASE || null;
  const enabled = !!(cfg && cfg.url && cfg.anonKey);

  async function fetchView(name, params) {
    if (!enabled) throw new Error("Supabase no configurado (supabase-config.local.js)");
    const qs = new URLSearchParams(params || {});
    if (!qs.has("select")) qs.set("select", "*");
    const res = await fetch(`${cfg.url.replace(/\/$/, "")}/rest/v1/${name}?${qs}`, {
      headers: { apikey: cfg.anonKey, Authorization: `Bearer ${cfg.anonKey}` },
    });
    if (!res.ok) throw new Error(`Supabase ${name}: HTTP ${res.status}`);
    return res.json();
  }

  // Pill de origen de datos — el jefe de flota siempre sabe qué está mirando.
  function showBadge(mode /* "supabase" | "mock" */, detail) {
    let el = document.getElementById("renovaDataBadge");
    if (!el) {
      el = document.createElement("div");
      el.id = "renovaDataBadge";
      el.style.cssText =
        "position:fixed;right:12px;bottom:12px;z-index:99;" +
        "font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:800;" +
        "letter-spacing:.08em;text-transform:uppercase;padding:7px 12px;" +
        "border-radius:8px;border:2px solid;background:#111E2E;pointer-events:none";
      document.body.appendChild(el);
    }
    if (mode === "supabase") {
      el.style.borderColor = "#1f9d6b";
      el.style.color = "#1f9d6b";
      el.textContent = "DATOS: SUPABASE" + (detail ? " · " + detail : "");
    } else {
      el.style.borderColor = "#f4b821";
      el.style.color = "#f4b821";
      el.textContent = "DATOS: DEMO LOCAL (MOCK)" + (detail ? " · " + detail : "");
    }
  }

  window.RenovaSupabase = { enabled, fetchView, showBadge };
})();
