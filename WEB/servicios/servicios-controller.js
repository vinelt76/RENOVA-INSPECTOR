import { createFilterBar } from "../shared/filter-bar.js";
import { loadServices, loadServicesProfile } from "./data.js";
import { createServicesRefreshFallback } from "./refresh-fallback.js";
import {
  casingHistoryHref,
  chipsFromSearch,
  filterServices,
  searchForChips,
  segmentsFromSummary,
  SERVICE_FACETS,
  serviceTypeMeta,
  summarizeServices,
  unitHref,
} from "./servicios-model.js";

const ALLOWED_ROLES = new Set(["operator", "tire_supervisor", "fleet_manager", "admin"]);
const REALTIME_TABLES = ["tire_movement_executions"];

const state = {
  status: "loading",
  rows: [],
  chips: chipsFromSearch(globalThis.location?.search),
  truncated: false,
  limit: null,
  requestId: 0,
  profile: null,
};

const elements = {
  main: document.querySelector(".services-main"),
  filterMount: document.getElementById("services-filter-mount"),
  truncated: document.getElementById("services-truncated"),
  total: document.getElementById("services-stat-total"),
  units: document.getElementById("services-stat-units"),
  orders: document.getElementById("services-stat-orders"),
  period: document.getElementById("services-stat-period"),
  segmentsEmpty: document.getElementById("services-segments-empty"),
  segmentsWrap: document.getElementById("services-segments-wrap"),
  segments: document.getElementById("services-segments"),
  legend: document.getElementById("services-legend"),
  status: document.getElementById("services-status"),
  list: document.getElementById("services-list"),
};

let activeClient = null;
let unsubscribeRealtime = null;
let stopRefreshFallback = null;

function createElement(tagName, className, value) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (value != null) element.textContent = value;
  return element;
}

function clean(value, fallback = "—") {
  const result = String(value ?? "").trim();
  return result || fallback;
}

function formatDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""))) return null;
  return new Intl.DateTimeFormat("es-PE", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`)).replaceAll(".", "");
}

function formatPeriod(summary) {
  const first = formatDate(summary?.firstDate);
  const last = formatDate(summary?.lastDate);
  if (!first) return "—";
  return first === last || !last ? first : `${first} → ${last}`;
}

// Un servicio es una posición atendida, así que la posición se dice una vez —
// como en la planilla—. La v1 mostraba `P3 → P7` porque una rotación era un
// casco reubicándose; ahora la salida y el ingreso son de la misma posición y
// esa flecha sería siempre `P3 → P3` (ADR-0008).
function positionLabel(row) {
  return row?.position_number == null ? "P?" : `P${row.position_number}`;
}

// Qué entra en esta posición, y de dónde viene cuando se pudo derivar dentro de
// la orden. `entry_origin_position` nulo significa que vino de afuera —retén,
// reparación, nuevo— y eso no se infiere: se declara indeterminado.
function entryLabel(row) {
  if (row?.direction !== "exit") return null;
  if (row?.pair_casing_code == null && row?.rotation_pairing === "not_paired") {
    return "ENTRA · SIN REEMPLAZO REGISTRADO";
  }
  const code = clean(row?.pair_casing_code, "SIN CÓDIGO");
  const origin = row?.entry_origin_position;
  if (origin == null) return `ENTRA · ${code} · ORIGEN NO DETERMINADO`;
  if (origin === row?.position_number) return `ENTRA · ${code} · VUELVE EL MISMO`;
  return `ENTRA · ${code} · DESDE P${origin}`;
}

function locationForChips(chips) {
  const url = new URL(globalThis.location.href);
  url.search = searchForChips(chips);
  return url;
}

function removeLastChip() {
  if (!state.chips.length) return;
  state.chips = state.chips.slice(0, -1);
  filterBar.setChips(state.chips);
  globalThis.history?.pushState?.({ serviceChips: state.chips }, "", locationForChips(state.chips));
  render();
}

const filterBar = createFilterBar({
  mount: elements.filterMount,
  facets: SERVICE_FACETS,
  rows: state.rows,
  chips: state.chips,
  onOpen() {},
  onChange(nextChips) {
    state.chips = nextChips;
    globalThis.history?.pushState?.({ serviceChips: state.chips }, "", locationForChips(state.chips));
    render();
  },
});

function renderStats(summary) {
  const hasRows = summary.total > 0;
  elements.total.textContent = hasRows ? String(summary.total) : "—";
  elements.units.textContent = hasRows ? String(summary.units) : "—";
  elements.orders.textContent = hasRows ? String(summary.orders) : "—";
  elements.period.textContent = hasRows ? formatPeriod(summary) : "—";
}

function renderSegments(summary) {
  const segments = segmentsFromSummary(summary);
  elements.segments.replaceChildren();
  elements.legend.replaceChildren();
  elements.segmentsWrap.hidden = segments.length === 0;
  elements.segmentsEmpty.hidden = segments.length > 0;
  if (!segments.length) {
    elements.segments.removeAttribute("aria-label");
    return;
  }

  const aria = segments.map((segment) => `${segment.label}: ${segment.count}, ${segment.percentage.toFixed(1)} %`).join("; ");
  elements.segments.setAttribute("aria-label", `Distribución de servicios. ${aria}`);
  for (const segment of segments) {
    const title = `${segment.label}: ${segment.count} · ${segment.percentage.toFixed(1)} %`;
    const bar = createElement("span", `services-segment tone-${segment.tone}`);
    bar.style.width = `${segment.percentage}%`;
    bar.title = title;
    elements.segments.append(bar);

    const legend = createElement("div", "services-legend-item");
    legend.append(
      createElement("span", `services-legend-swatch tone-${segment.tone}`),
      createElement("span", "services-legend-name", segment.label),
      createElement("strong", null, `${segment.count} · ${segment.percentage.toFixed(1)} %`),
    );
    elements.legend.append(legend);
  }
}

function appendCasing(container, row) {
  const href = casingHistoryHref(row);
  if (row?.code_unreadable === true) {
    container.append(createElement("span", "services-casing is-muted", "SIN CÓDIGO LEGIBLE"));
    return;
  }
  const code = clean(row?.casing_code, "SIN CÓDIGO");
  if (href) {
    const link = createElement("a", "services-casing casing-history-link", code);
    link.href = href;
    link.setAttribute("aria-label", `Ver historial del neumático ${code}`);
    container.append(link);
    return;
  }
  container.append(createElement("span", "services-casing", code));
  if (row?.casing_code && row?.casing_exists !== true) {
    const tag = createElement("span", "services-tag", "SIN HISTORIAL");
    tag.title = "El código fue capturado, pero no existe un casco registrado y navegable con ese código.";
    container.append(tag);
  }
}

function createServiceRow(row) {
  const article = createElement("article", "services-row");
  const header = createElement("div", "services-row-primary");
  const meta = serviceTypeMeta(row?.service_type);
  const type = createElement("span", `services-type tone-${meta?.tone ?? "blue-6"}`, meta?.label ?? clean(row?.service_type, "SERVICIO"));
  const position = createElement("strong", "services-position", positionLabel(row));
  header.append(type, position);

  if (row?.rotation_pairing === "inferred") {
    const inferred = createElement("span", "services-tag is-inferred", "ATRIBUCIÓN INFERIDA");
    inferred.title = "El total es correcto, pero la atribución del ingreso a esta salida es aproximada.";
    header.append(inferred);
  }

  const identity = createElement("div", "services-row-identity");
  const unitLinkHref = unitHref(row);
  if (unitLinkHref) {
    const plate = createElement("a", "services-plate", clean(row?.plate));
    plate.href = unitLinkHref;
    plate.setAttribute("aria-label", `Ver inspecciones de la unidad ${clean(row?.plate)}`);
    identity.append(plate);
  } else {
    identity.append(createElement("span", "services-plate is-muted", "UNIDAD SIN PLACA"));
  }
  appendCasing(identity, row);

  const facts = createElement("div", "services-row-facts");
  facts.append(
    createElement("span", null, `${clean(row?.condition)} · ${clean(row?.retread_design)}`),
    createElement("span", null, row?.rtd_min_mm == null ? "RTD —" : `${Number(row.rtd_min_mm).toFixed(1)} mm`),
    createElement("span", null, `${clean(row?.brand_name)} · ${clean(row?.size_name)}`),
    createElement("span", "services-when", `${formatDate(row?.captured_on) ?? "FECHA SIN REGISTRO"} · ${clean(row?.captured_by_name, "OPERARIO SIN REGISTRO")}`),
  );
  const entry = entryLabel(row);
  if (entry) facts.append(createElement("span", "services-entry", entry));
  article.append(header, identity, facts);
  return article;
}

function renderList(rows) {
  elements.list.replaceChildren();
  if (!rows.length) return;
  const fragment = document.createDocumentFragment();
  for (const row of rows) fragment.append(createServiceRow(row));
  elements.list.append(fragment);
}

function renderStatus(visibleRows) {
  elements.status.replaceChildren();
  const messages = {
    loading: "Cargando servicios ejecutados…",
    unconfigured: "Supabase no está configurado para esta pantalla.",
    unauthorized: "Inicia sesión para consultar los servicios de tu empresa.",
    forbidden: "Tu rol no tiene acceso a los servicios de movimiento.",
    error: "No se pudieron cargar los servicios. Verifica la conexión e intenta nuevamente.",
  };
  if (messages[state.status]) {
    elements.status.hidden = false;
    elements.status.append(createElement("span", null, messages[state.status]));
    if (state.status === "error") {
      const retry = createElement("button", "services-retry", "Reintentar");
      retry.type = "button";
      retry.addEventListener("click", () => void reload());
      elements.status.append(retry);
    }
    return;
  }
  if (state.rows.length === 0) {
    elements.status.hidden = false;
    elements.status.append(createElement("span", null, "Todavía no hay servicios ejecutados para tu empresa."));
    return;
  }
  if (visibleRows.length === 0) {
    elements.status.hidden = false;
    elements.status.append(createElement("span", null, "Ningún servicio coincide con los filtros."));
    if (state.chips.length) {
      const remove = createElement("button", "services-retry", "Quitar último filtro");
      remove.type = "button";
      remove.addEventListener("click", removeLastChip);
      elements.status.append(remove);
    }
    return;
  }
  elements.status.hidden = true;
}

function render() {
  const ready = state.status === "ready";
  const visibleRows = ready ? filterServices(state.rows, { chips: state.chips }) : [];
  const summary = summarizeServices(visibleRows);
  elements.main?.setAttribute("aria-busy", String(state.status === "loading"));
  filterBar.setRows(ready ? state.rows : []);
  renderStats(summary);
  renderSegments(summary);
  renderStatus(visibleRows);
  renderList(visibleRows);

  elements.truncated.hidden = !(ready && state.truncated);
  elements.truncated.textContent = ready && state.truncated
    ? `Se muestran los ${state.limit} servicios más recientes. Acotá con filtros para revisar este corte; puede haber registros anteriores.`
    : "";
}

async function reload({ silent = false } = {}) {
  if (!activeClient) return;
  const requestId = ++state.requestId;
  if (!silent || state.status !== "ready") {
    state.status = "loading";
    render();
  }
  try {
    const result = await loadServices({}, activeClient);
    if (requestId !== state.requestId) return;
    state.rows = result.rows;
    state.limit = result.limit;
    state.truncated = result.truncated;
    state.status = "ready";
    activeClient.showBadge?.("supabase", result.rows[0]?.company_name ?? state.profile?.full_name ?? "");
  } catch (error) {
    if (requestId !== state.requestId) return;
    console.warn("Servicios: no se pudo cargar la vista.", error);
    if (silent && state.status === "ready") return;
    state.rows = [];
    state.truncated = false;
    state.status = "error";
  }
  render();
}

async function init(client) {
  activeClient = client;
  if (!client?.enabled) {
    state.status = "unconfigured";
    client?.showBadge?.("empty");
    render();
    return;
  }
  let session = null;
  try {
    session = await client.requireAuth();
  } catch (error) {
    console.warn("Servicios: no se pudo iniciar o recuperar la sesión.", error);
    state.status = "error";
    render();
    return;
  }
  if (!session?.user?.id) {
    state.status = "unauthorized";
    render();
    return;
  }
  try {
    state.profile = await loadServicesProfile(session.user.id, client);
  } catch (error) {
    console.warn("Servicios: no se pudo verificar el perfil.", error);
    state.status = "error";
    render();
    return;
  }
  if (!state.profile?.active || !ALLOWED_ROLES.has(state.profile.role)) {
    state.status = "forbidden";
    client.showBadge?.("supabase", session.user.email ?? "");
    render();
    return;
  }
  await reload();
  unsubscribeRealtime?.();
  unsubscribeRealtime = client.onDataChange(REALTIME_TABLES, () => void reload({ silent: true }));
  stopRefreshFallback?.();
  stopRefreshFallback = createServicesRefreshFallback({
    refresh: () => reload({ silent: true }),
  });
}

globalThis.addEventListener("popstate", () => {
  state.chips = chipsFromSearch(globalThis.location.search);
  filterBar.setChips(state.chips);
  render();
});
globalThis.addEventListener("pagehide", () => {
  unsubscribeRealtime?.();
  stopRefreshFallback?.();
}, { once: true });

render();
globalThis.onRenovaSupabaseReady(() => void init(globalThis.RenovaSupabase));
