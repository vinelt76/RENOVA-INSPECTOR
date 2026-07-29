/* RENOVA — adaptador de LECTURA Supabase para los dashboards HTML (con login).
   Sin credenciales acá: la config vive en supabase-config.public.js (URL + anon
   key, seguras de commitear — la protección real es RLS por empresa, ver
   supabase/migrations/20260710090000_dashboard_public_rls.sql) o en
   supabase-config.local.js para desarrollo.
   Si no hay config o la red falla, cada dashboard muestra estado sin datos.

   API:
     RenovaSupabase.enabled                 → bool (hay config)
     RenovaSupabase.requireAuth()           → Promise<Session> (pinta login si falta sesión)
     RenovaSupabase.signIn(email, password) → Promise<{data,error}>
     RenovaSupabase.signOut()               → Promise<void>
     RenovaSupabase.getSession()            → Promise<Session|null>
     RenovaSupabase.fetchView(name, params) → Promise<rows>  (REST /rest/v1, GET, con sesión)
     RenovaSupabase.showBadge(mode, detail) → pill fija "DATOS: …" abajo a la derecha
     RenovaSupabase.onDataChange(tables, cb) → unsubscribe()  (Realtime, debounced 400ms)
*/
import { createClient } from "./vendor/supabase-js.mjs";

const cfg = window.RENOVA_SUPABASE || null;
const enabled = !!(cfg && cfg.url && cfg.anonKey);
const supabase = enabled ? createClient(cfg.url, cfg.anonKey) : null;

async function fetchView(name, params) {
  if (!enabled) throw new Error("Supabase no configurado (supabase-config.public.js)");
  const qs = new URLSearchParams(params || {});
  if (!qs.has("select")) qs.set("select", "*");
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${cfg.url.replace(/\/$/, "")}/rest/v1/${name}?${qs}`, {
    headers: {
      apikey: cfg.anonKey,
      Authorization: `Bearer ${session ? session.access_token : cfg.anonKey}`,
    },
  });
  if (!res.ok) throw new Error(`Supabase ${name}: HTTP ${res.status}`);
  return res.json();
}

// Pill de origen de datos — el jefe de flota siempre sabe qué está mirando.
// Cuando hay sesión activa (mode "supabase"), incluye un botón "Cambiar
// empresa" para cerrar sesión sin pasar por la consola del navegador.
function showBadge(mode /* "supabase" | "empty" */, detail) {
  let el = document.getElementById("renovaDataBadge");
  if (!el) {
    el = document.createElement("div");
    el.id = "renovaDataBadge";
    el.style.cssText =
      "position:fixed;right:12px;bottom:12px;z-index:99;" +
      "font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:800;" +
      "letter-spacing:.08em;text-transform:uppercase;" +
      "display:flex;align-items:center;gap:8px;";
    document.body.appendChild(el);
  }
  const pillStyle =
    "padding:7px 12px;border-radius:8px;border:2px solid;background:#111E2E;";
  if (mode === "supabase") {
    el.innerHTML = `
      <button id="renovaLogoutBtn" type="button" style="${pillStyle}border-color:#1B2D42;color:#F0F8FF;
        cursor:pointer;font:inherit;letter-spacing:inherit;text-transform:inherit;
        display:flex;align-items:center;gap:8px;">
        <span style="color:#7AABCC;">SN</span> · SUPERVISOR DE NEUMÁTICOS${detail ? " · " + detail : ""}
      </button>`;
    const btn = el.querySelector("#renovaLogoutBtn");
    btn.addEventListener("click", async () => {
      if (!confirm("¿Cerrar sesión?")) return;
      btn.disabled = true;
      btn.textContent = "SALIENDO…";
      await signOut();
      location.reload();
    });
  } else {
    el.innerHTML = `<span style="${pillStyle}border-color:#f4b821;color:#f4b821;">DATOS: SIN SUPABASE${detail ? " · " + detail : ""}</span>`;
  }
}

function signIn(email, password) {
  if (!enabled) return Promise.reject(new Error("Supabase no configurado"));
  return supabase.auth.signInWithPassword({ email, password });
}

function signOut() {
  if (!enabled) return Promise.resolve();
  return supabase.auth.signOut();
}

async function getSession() {
  if (!enabled) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

function onAuthStateChange(cb) {
  if (!enabled) return { data: { subscription: { unsubscribe() {} } } };
  return supabase.auth.onAuthStateChange(cb);
}

// Modal de login mínimo — inyectado inline (mismo criterio que showBadge:
// sin depender de CSS/HTML externo, para que cada dashboard solo agregue
// `await RenovaSupabase.requireAuth()` antes de cargar sus datos.
function renderLoginModal(onSuccess) {
  const overlay = document.createElement("div");
  overlay.id = "renovaLoginOverlay";
  overlay.style.cssText =
    "position:fixed;inset:0;z-index:9999;background:#07111C;" +
    "display:flex;align-items:center;justify-content:center;" +
    "font-family:'JetBrains Mono',monospace;";
  overlay.innerHTML = `
    <form id="renovaLoginForm" style="width:min(320px,90vw);background:#111E2E;
      border:2px solid #1B2D42;border-radius:14px;padding:28px 24px;display:flex;
      flex-direction:column;gap:14px;">
      <div style="color:#F0F8FF;font-weight:800;font-size:16px;letter-spacing:.04em;">
        RENOVA INSPECTOR
      </div>
      <div style="color:#7AABCC;font-size:11px;font-weight:700;letter-spacing:.08em;
        margin-bottom:4px;">
        Iniciar sesión para ver los datos de tu empresa
      </div>
      <input name="email" type="email" placeholder="Correo" required autocomplete="username"
        style="border:2px solid #1B2D42;border-radius:8px;background:#07111C;color:#F0F8FF;
        padding:11px 12px;font-size:13px;font-family:inherit;outline:none;" />
      <input name="password" type="password" placeholder="Contraseña" required
        autocomplete="current-password"
        style="border:2px solid #1B2D42;border-radius:8px;background:#07111C;color:#F0F8FF;
        padding:11px 12px;font-size:13px;font-family:inherit;outline:none;" />
      <div id="renovaLoginError" style="display:none;color:#E5484D;font-size:11px;
        font-weight:700;"></div>
      <button type="submit" style="border:none;border-radius:8px;background:#F06822;
        color:#fff;padding:12px;font-weight:800;font-size:13px;letter-spacing:.04em;
        cursor:pointer;font-family:inherit;">
        ENTRAR
      </button>
    </form>`;
  document.body.appendChild(overlay);

  const form = overlay.querySelector("#renovaLoginForm");
  const errorEl = overlay.querySelector("#renovaLoginError");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.style.display = "none";
    const email = form.email.value.trim();
    const password = form.password.value;
    const submitBtn = form.querySelector("button[type=submit]");
    submitBtn.disabled = true;
    submitBtn.textContent = "ENTRANDO…";
    const { data, error } = await signIn(email, password);
    if (error) {
      errorEl.textContent = "Correo o contraseña incorrectos.";
      errorEl.style.display = "block";
      submitBtn.disabled = false;
      submitBtn.textContent = "ENTRAR";
      return;
    }
    overlay.remove();
    onSuccess(data.session);
  });
}

function requireAuth() {
  if (!enabled) return Promise.resolve(null);
  return new Promise((resolve) => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) return resolve(data.session);
      renderLoginModal(resolve);
    });
  });
}

// Refresco en vivo: se suscribe a INSERT/UPDATE/DELETE de las tablas dadas
// (RLS ya filtra por empresa — Realtime respeta la misma policy que SELECT,
// el usuario solo recibe eventos de sus propias filas) y llama a `cb` con un
// debounce chico, para no disparar un refresh por cada fila cuando
// save_inspection() escribe varias mediciones de una sola inspección de
// golpe. Devuelve una función para cancelar la suscripción.
function onDataChange(tables, cb) {
  if (!enabled) return () => {};
  let timer = null;
  const debounced = () => {
    clearTimeout(timer);
    timer = setTimeout(cb, 400);
  };
  const channel = supabase.channel(`renova-live-${tables.join("-")}`);
  for (const table of tables) {
    channel.on("postgres_changes", { event: "*", schema: "public", table }, debounced);
  }
  channel.subscribe();
  return () => {
    clearTimeout(timer);
    supabase.removeChannel(channel);
  };
}

window.RenovaSupabase = {
  enabled,
  supabase,
  fetchView,
  showBadge,
  signIn,
  signOut,
  getSession,
  onAuthStateChange,
  requireAuth,
  onDataChange,
};

// Este módulo se carga con type="module" (diferido) para poder importar
// supabase-js — puede terminar de ejecutarse DESPUÉS de que el <script>
// clásico de cada dashboard llegue a su init. Cada dashboard debe envolver
// su arranque en window.onRenovaSupabaseReady(fn) en vez de asumir que
// window.RenovaSupabase ya existe.
window.dispatchEvent(new CustomEvent("renova-supabase-ready"));

