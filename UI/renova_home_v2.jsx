import { useState } from "react";

const MONO = '"JetBrains Mono", "IBM Plex Mono", "SFMono-Regular", Menlo, monospace';
const NAVY = "#15233f";
const ORANGE = "#e85420";
const YELLOW = "#f4b821";
const INK = "#15233f";

const EMPRESAS = [
  { id: "movil", nombre: "Móvil Bus", flota: "48 unidades" },
  { id: "cruz", nombre: "Cruz del Sur", flota: "112 unidades" },
  { id: "civa", nombre: "CIVA", flota: "76 unidades" },
  { id: "ittsa", nombre: "ITTSABUS", flota: "34 unidades" },
  { id: "cta", nombre: "CTA", flota: "29 unidades" },
];

function iniciales(nombre) {
  const limpio = nombre.replace(/[^A-Za-zÁÉÍÓÚÑ ]/g, "").trim();
  const partes = limpio.split(" ").filter(Boolean);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

function fechaHoy() {
  const d = new Date();
  const dias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${dias[d.getDay()]} ${d.getDate()} ${meses[d.getMonth()]} ${d.getFullYear()}`;
}

// Indicador de progreso compartido — paso activo como pill naranja, pasos previos claros
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

export default function RenovaHome() {
  const [open, setOpen] = useState(false);
  const [sel, setSel]   = useState(null);

  const seleccionada = EMPRESAS.find((e) => e.id === sel);

  return (
    <div style={{ minHeight: "100vh", background: "#cbd5e1", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: MONO }}>
      <div style={{ width: 390, height: 760, background: "#fff", borderRadius: 28, overflow: "hidden", boxShadow: "0 24px 64px rgba(21,35,63,0.30)", display: "flex", flexDirection: "column", position: "relative" }}>

        {/* Header */}
        <div style={{ background: NAVY, padding: "22px 24px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: ORANGE, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "#fff", fontSize: 18 }}>R</div>
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 20, letterSpacing: "0.14em" }}>RENOVA</span>
          </div>
          <StepDots current={1} />
        </div>

        {/* Body */}
        <div style={{ flex: 1, padding: "28px 24px", display: "flex", flexDirection: "column" }}>

          {/* Tarjeta amarilla — ahora muestra fecha + pregunta */}
          <div style={{ background: YELLOW, borderRadius: 18, padding: "20px 22px", marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: NAVY, letterSpacing: "0.12em", opacity: 0.6, marginBottom: 4 }}>HOY</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: NAVY, marginBottom: 12 }}>{fechaHoy()}</div>
            <div style={{ height: 1, background: "rgba(21,35,63,0.15)", marginBottom: 14 }} />
            <div style={{ fontSize: 25, fontWeight: 800, color: NAVY, lineHeight: 1.2, letterSpacing: "-0.01em" }}>
              ¿A quién<br />inspeccionamos?
            </div>
          </div>

          {/* Label */}
          <div style={{ fontSize: 11, fontWeight: 800, color: NAVY, letterSpacing: "0.14em", marginBottom: 8 }}>EMPRESA</div>

          {/* Accordion */}
          <div style={{ border: `2px solid ${open || sel ? NAVY : "#c7d0de"}`, borderRadius: 14, overflow: "hidden", background: "#fff", transition: "border-color 0.15s" }}>

            {/* Trigger — minHeight 58px cubre el touch target de todo el botón */}
            <button
              onClick={() => setOpen((o) => !o)}
              style={{ width: "100%", background: "none", border: "none", padding: "0 18px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", fontFamily: MONO, minHeight: 58 }}
            >
              {seleccionada ? (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: NAVY, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13 }}>
                    {iniciales(seleccionada.nombre)}
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: INK }}>{seleccionada.nombre}</div>
                    <div style={{ fontSize: 12, color: "#7b879c" }}>{seleccionada.flota}</div>
                  </div>
                </div>
              ) : (
                <span style={{ fontSize: 15, color: "#7b879c", fontWeight: 600 }}>Seleccionar empresa</span>
              )}

              {/* Chevron con área de toque explícita ≥ 44 × 44 px (HIG) */}
              <div style={{ minWidth: 44, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                <span style={{ color: ORANGE, fontSize: 20, fontWeight: 800, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s", display: "inline-block" }}>⌄</span>
              </div>
            </button>

            {/* Lista expandida */}
            <div style={{ maxHeight: open ? 400 : 0, transition: "max-height 0.25s ease", overflow: "hidden" }}>
              <div style={{ borderTop: "1px solid #e8edf4" }}>
                {EMPRESAS.map((e, i) => {
                  const activa = e.id === sel;
                  return (
                    <button
                      key={e.id}
                      onClick={() => { setSel(e.id); setOpen(false); }}
                      style={{ width: "100%", background: activa ? "#fbf3df" : "#fff", border: "none", borderTop: i === 0 ? "none" : "1px solid #f0f3f8", borderLeft: activa ? `4px solid ${ORANGE}` : "4px solid transparent", padding: "0 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", fontFamily: MONO, textAlign: "left", minHeight: 60 }}
                    >
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: activa ? ORANGE : "#eef1f6", color: activa ? "#fff" : NAVY, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, flexShrink: 0 }}>
                        {iniciales(e.nombre)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: INK }}>{e.nombre}</div>
                        <div style={{ fontSize: 11, color: "#9aa4b6" }}>{e.flota}</div>
                      </div>
                      {activa && <span style={{ color: ORANGE, fontWeight: 800, fontSize: 16 }}>✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={{ flex: 1 }} />

          {/* CTA */}
          <button
            disabled={!sel}
            style={{ background: sel ? ORANGE : "#dfe4ec", color: sel ? "#fff" : "#a5afc0", border: "none", borderRadius: 14, padding: "17px", fontWeight: 800, fontSize: 15, letterSpacing: "0.04em", cursor: sel ? "pointer" : "default", fontFamily: MONO, transition: "background 0.15s" }}
          >
            COMENZAR INSPECCIÓN
          </button>
        </div>
      </div>
    </div>
  );
}
