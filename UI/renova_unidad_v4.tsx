import { useState } from "react";

const MONO  = '"JetBrains Mono", "IBM Plex Mono", "SFMono-Regular", Menlo, monospace';
const NAVY  = "#15233f";
const ORANGE= "#e85420";
const YELLOW= "#f5c842";
const INK   = "#15233f";
const MUTED = "#9aa4b6";
const BORDER= "#c7d0de";

// Mock — cada unidad con su última inspección y su configuración guardada
const UNIDADES = [
  { id: "2101", config: "2-4",   ultima: { fecha: "2025-06-10", odometro: 145230 } },
  { id: "2104", config: "2-4",   ultima: { fecha: "2025-05-22", odometro:  98750 } },
  { id: "2118", config: "2-4-2", ultima: { fecha: "2025-06-01", odometro: 210000 } },
  { id: "4821", config: "2-4",   ultima: { fecha: "2025-04-15", odometro: 320500 } },
  { id: "4830", config: "2-4",   ultima: { fecha: "2025-06-18", odometro:  87200 } },
  { id: "212",  config: "2-4-4", ultima: { fecha: "2025-03-30", odometro: 456000 } },
  { id: "315",  config: "2-4-4", ultima: { fecha: "2025-06-05", odometro: 178900 } },
];

// Configuraciones — notación llantas-por-eje. El total y el layout salen de aquí.
const CONFIGS = [
  { notacion: "2-4",     tipo: "Bus / camión 2 ejes" },
  { notacion: "2-4-2",   tipo: "Bus 3 ejes · eje tag" },
  { notacion: "2-4-4",   tipo: "Tracto · doble tracción" },
  { notacion: "2-4-4-4", tipo: "Tracto 4 ejes" },
];
const llantasDe = (notacion) =>
  notacion.split("-").reduce((acc, n) => acc + (parseInt(n, 10) || 0), 0);

function fmtFecha(iso) {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-PE", {
    day: "numeric", month: "long", year: "numeric",
  });
}
function fmtKm(n) {
  return Number(n).toLocaleString("es-PE") + " km";
}

function StepDots({ current, total = 4 }) {
  return (
    <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
      {Array.from({ length: total }, (_, i) => {
        const active = i + 1 === current;
        const done   = i + 1 < current;
        if (active) return <div key={i} style={{ width: 20, height: 6, borderRadius: 3, background: ORANGE }} />;
        return <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: done ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.22)" }} />;
      })}
    </div>
  );
}

function SearchIcon({ active }) {
  const color = active ? ORANGE : MUTED;
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ marginRight: 10, flexShrink: 0 }} aria-hidden="true">
      <circle cx="7.5" cy="7.5" r="5" stroke={color} strokeWidth="2" />
      <path d="M11.5 11.5L16 16" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function RenovaUnidad() {
  const [query,    setQuery]    = useState("");
  const [odometro, setOdometro] = useState("");
  const [config,   setConfig]   = useState("");   // solo para unidad nueva

  const q          = query.trim();
  const showResult = q.length >= 3;
  const match      = showResult ? UNIDADES.find((u) => u.id === q) ?? null : null;
  const noExiste   = showResult && !match;

  const kmPrev   = match ? match.ultima.odometro : 0;
  const kmActual = parseInt(odometro || "0", 10);
  const kmBajo   = match && odometro.length > 0 && kmActual < kmPrev;

  const canContinue = !!match    && odometro.length > 0 && !kmBajo;
  const canCreate   = !!noExiste && odometro.length > 0 && !!config;

  const reset = () => { setQuery(""); setOdometro(""); setConfig(""); };

  return (
    <div style={{ minHeight: "100vh", background: "#cbd5e1", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: MONO }}>
      <div style={{ width: 390, height: 760, background: "#fff", borderRadius: 28, overflow: "hidden", boxShadow: "0 24px 64px rgba(21,35,63,0.30)", display: "flex", flexDirection: "column" }}>

        {/* ── Header ── */}
        <div style={{ background: NAVY, padding: "16px 20px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <button aria-label="Volver" style={{ background: "none", border: "none", color: "rgba(255,255,255,0.9)", fontSize: 22, cursor: "pointer", minWidth: 44, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", padding: 0, flexShrink: 0 }}>←</button>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
            <div style={{ width: 30, height: 30, borderRadius: 7, background: ORANGE, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "#fff", fontSize: 15 }}>R</div>
            <div>
              <div style={{ color: "#fff", fontWeight: 800, fontSize: 15, letterSpacing: "0.1em" }}>RENOVA</div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>Móvil Bus</div>
            </div>
          </div>
          <StepDots current={2} />
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, padding: "24px 24px 20px", display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Label + buscador */}
          <div style={{ fontSize: 11, fontWeight: 800, color: NAVY, letterSpacing: "0.14em", marginBottom: 10, flexShrink: 0 }}>UNIDAD</div>
          <div style={{ border: `2px solid ${q ? (match ? ORANGE : (noExiste ? BORDER : NAVY)) : BORDER}`, borderRadius: 14, display: "flex", alignItems: "center", padding: "0 16px", background: "#fff", transition: "border-color 0.15s", flexShrink: 0 }}>
            <SearchIcon active={!!match} />
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value.replace(/[^0-9]/g, "")); setOdometro(""); setConfig(""); }}
              inputMode="numeric"
              placeholder="N.º de unidad"
              style={{ flex: 1, border: "none", outline: "none", padding: "16px 0", fontSize: 20, fontWeight: 800, color: INK, background: "transparent", fontFamily: MONO, letterSpacing: "0.04em" }}
            />
            {query && (
              <button onClick={reset} aria-label="Borrar" style={{ background: "none", border: "none", color: MUTED, fontSize: 16, cursor: "pointer", minWidth: 44, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            )}
          </div>

          {/* ── Estado vacío ── */}
          {!showResult && (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontSize: 13, color: MUTED, textAlign: "center", lineHeight: 1.7 }}>
                Ingresa el número de la unidad<br />para continuar.
              </div>
            </div>
          )}

          {/* ── MATCH: última inspección (fecha grande) + odómetro ── */}
          {match && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 20, flex: 1 }}>

              {/* Banner — la fecha es el héroe */}
              <div style={{ background: NAVY, borderRadius: 16, padding: "20px 22px", flexShrink: 0 }}>
                <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", marginBottom: 8 }}>ÚLTIMA INSPECCIÓN</div>
                <div style={{ color: "#fff", fontWeight: 800, fontSize: 24, lineHeight: 1.1, letterSpacing: "-0.01em" }}>
                  {fmtFecha(match.ultima.fecha)}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
                  <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em" }}>ODÓMETRO</span>
                  <span style={{ color: YELLOW, fontWeight: 800, fontSize: 14 }}>{fmtKm(match.ultima.odometro)}</span>
                </div>
              </div>

              {/* Odómetro actual */}
              <div style={{ flexShrink: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, letterSpacing: "0.14em", marginBottom: 8 }}>ODÓMETRO ACTUAL</div>
                <div style={{ border: `2px solid ${odometro ? (kmBajo ? ORANGE : NAVY) : BORDER}`, borderRadius: 14, display: "flex", alignItems: "center", padding: "0 16px", background: "#fff", transition: "border-color 0.15s" }}>
                  <input
                    value={odometro}
                    onChange={(e) => setOdometro(e.target.value.replace(/[^0-9]/g, ""))}
                    inputMode="numeric"
                    placeholder="0"
                    autoFocus
                    style={{ flex: 1, border: "none", outline: "none", padding: "14px 0", fontSize: 24, fontWeight: 800, color: INK, background: "transparent", fontFamily: MONO, letterSpacing: "0.04em" }}
                  />
                  <span style={{ color: MUTED, fontSize: 13, fontWeight: 700, flexShrink: 0 }}>km</span>
                </div>
                {kmBajo && (
                  <div style={{ fontSize: 11, color: ORANGE, fontWeight: 700, marginTop: 7, paddingLeft: 4 }}>
                    ⚠ Menor al anterior ({fmtKm(kmPrev)})
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── NO EXISTE: nueva unidad → odómetro + configuración ── */}
          {noExiste && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 20, flex: 1, overflowY: "auto" }}>

              {/* Banner nueva unidad */}
              <div style={{ border: `2px dashed ${ORANGE}`, borderRadius: 16, padding: "16px 20px", display: "flex", gap: 14, alignItems: "center", flexShrink: 0 }}>
                <div style={{ width: 40, height: 40, borderRadius: 11, background: ORANGE, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontWeight: 800, fontSize: 24, color: "#fff", lineHeight: 1 }}>+</div>
                <div>
                  <div style={{ color: ORANGE, fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", marginBottom: 3 }}>UNIDAD NUEVA</div>
                  <div style={{ color: INK, fontWeight: 800, fontSize: 15 }}>Unidad {q}</div>
                </div>
              </div>

              {/* Odómetro inicial */}
              <div style={{ flexShrink: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, letterSpacing: "0.14em", marginBottom: 8 }}>ODÓMETRO INICIAL</div>
                <div style={{ border: `2px solid ${odometro ? NAVY : BORDER}`, borderRadius: 14, display: "flex", alignItems: "center", padding: "0 16px", background: "#fff", transition: "border-color 0.15s" }}>
                  <input
                    value={odometro}
                    onChange={(e) => setOdometro(e.target.value.replace(/[^0-9]/g, ""))}
                    inputMode="numeric"
                    placeholder="0"
                    style={{ flex: 1, border: "none", outline: "none", padding: "14px 0", fontSize: 24, fontWeight: 800, color: INK, background: "transparent", fontFamily: MONO, letterSpacing: "0.04em" }}
                  />
                  <span style={{ color: MUTED, fontSize: 13, fontWeight: 700, flexShrink: 0 }}>km</span>
                </div>
              </div>

              {/* Configuración del vehículo — se guarda una sola vez */}
              <div style={{ flexShrink: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, letterSpacing: "0.14em", marginBottom: 8 }}>CONFIGURACIÓN DEL VEHÍCULO</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {CONFIGS.map((c) => {
                    const sel = config === c.notacion;
                    return (
                      <button
                        key={c.notacion}
                        onClick={() => setConfig(c.notacion)}
                        style={{ background: sel ? "#fbf3df" : "#fff", border: `2px solid ${sel ? ORANGE : BORDER}`, borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", fontFamily: MONO, textAlign: "left", minHeight: 56 }}
                      >
                        <span style={{ fontSize: 18, fontWeight: 900, color: sel ? ORANGE : NAVY, letterSpacing: "0.04em", flexShrink: 0, width: 64 }}>{c.notacion}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 800, fontSize: 13, color: INK }}>{llantasDe(c.notacion)} llantas</div>
                          <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{c.tipo}</div>
                        </div>
                        {sel && <span style={{ color: ORANGE, fontWeight: 800, fontSize: 16, flexShrink: 0 }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── CTA ── */}
          {showResult && (
            <button
              disabled={!canContinue && !canCreate}
              style={{
                background : canContinue ? ORANGE : canCreate ? NAVY : "#dfe4ec",
                color      : (canContinue || canCreate) ? "#fff" : "#a5afc0",
                border     : "none",
                borderRadius: 14,
                padding    : "17px",
                fontWeight : 800,
                fontSize   : 15,
                letterSpacing: "0.04em",
                cursor     : (canContinue || canCreate) ? "pointer" : "default",
                fontFamily : MONO,
                marginTop  : 16,
                flexShrink : 0,
                transition : "background 0.15s",
              }}
            >
              {noExiste ? "CREAR UNIDAD" : "CONTINUAR INSPECCIÓN"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
