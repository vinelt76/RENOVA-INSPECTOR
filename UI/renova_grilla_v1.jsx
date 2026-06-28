import { useState, useRef } from "react";

const MONO = '"JetBrains Mono", "IBM Plex Mono", "SFMono-Regular", Menlo, monospace';
const NAVY   = "#15233f";
const ORANGE = "#e85420";
const YELLOW = "#f4b821";
const INK    = "#15233f";
const BORDER = "#c7d0de";
const FIELD_BG = "#f6f8fb";
const MUTED  = "#7b879c";
const GREEN  = "#1f9d6b";

const MARCAS = ["Michelin", "Bridgestone", "Continental", "Pirelli", "Goodyear", "Firestone", "Hankook", "Yokohama", "Dunlop", "Triangle"];
const MODELOS_POR_MARCA = {
  Michelin: ["XDA2+", "X Multi Z", "XZE2+", "X Multi D"], Bridgestone: ["M729", "R168", "M788", "G611"],
  Continental: ["HDR2", "HSR2"], Pirelli: ["TH01", "FR01", "FG01"], Goodyear: ["G286", "G287"],
  Firestone: ["FS591", "FS400"], Hankook: ["DH05", "AH11"], Yokohama: ["101ZL", "TY517"],
  Dunlop: ["SP320", "SP431"], Triangle: ["TR685", "TRS02"],
};
const modelosDe = (m) => MODELOS_POR_MARCA[m] || [];
const REENCAUCHES = ["R1", "R2", "R3", "R4"];
const MEDIDAS = ["295/80 R22.5", "315/80 R22.5", "275/70 R22.5", "385/65 R22.5", "11R22.5", "12R22.5"];
const ANOMALIAS = ["Corte lateral", "Burbuja", "Desgaste irregular", "Banda separada", "Daño en talón", "Separación de capas", "Otro"];
const VALVULA = ["OK", "Falta", "Dañada", "Sucia", "Reemplazar"];

// Config 2-4-2 + etiquetas físicas
const POS = {
  1: { etq: "Dir izq",    eje: "Direccional" },
  2: { etq: "Dir der",    eje: "Direccional" },
  3: { etq: "Trac izq E", eje: "Tracción" },
  4: { etq: "Trac izq I", eje: "Tracción" },
  5: { etq: "Trac der I", eje: "Tracción" },
  6: { etq: "Trac der E", eje: "Tracción" },
  7: { etq: "Libre izq",  eje: "Libre" },
  8: { etq: "Libre der",  eje: "Libre" },
};
// Orden de filas = recorrido físico de caminata
const FILAS = [1, 3, 4, 7, 8, 6, 5, 2];
const CELDAS = ["r1", "r2", "r3", "r4", "presion"];

const empty = () => ({ codigo: "", r1: "", r2: "", r3: "", r4: "", presion: "", tapaValvula: "", anomalia: "", marca: "", modeloNeumatico: "", modeloActual: "", reencauche: "", medida: "" });

const MOCK = {
  1: { codigo: "MIC-2104-01", r1: "12", r2: "11", r3: "12", r4: "13", presion: "110", tapaValvula: "OK", anomalia: "", marca: "Michelin", modeloNeumatico: "XDA2+", modeloActual: "XDA2+", reencauche: "R2", medida: "295/80 R22.5" },
  3: { codigo: "BRI-2104-03", r1: "9", r2: "9", r3: "8", r4: "9", presion: "108", tapaValvula: "OK", anomalia: "", marca: "Bridgestone", modeloNeumatico: "M729", modeloActual: "M729", reencauche: "R1", medida: "295/80 R22.5" },
  4: { codigo: "BRI-2104-04", r1: "8", r2: "", r3: "", r4: "", presion: "", tapaValvula: "", anomalia: "Desgaste irregular", marca: "Bridgestone", modeloNeumatico: "M729", modeloActual: "M729", reencauche: "R1", medida: "295/80 R22.5" },
  7: { codigo: "CON-2104-07", r1: "", r2: "", r3: "", r4: "", presion: "", tapaValvula: "", anomalia: "", marca: "Continental", modeloNeumatico: "HDR2", modeloActual: "HDR2", reencauche: "", medida: "295/80 R22.5" },
};

const labelStyle = { fontSize: 11, fontWeight: 800, color: MUTED, letterSpacing: "0.12em", display: "block", marginBottom: 6, fontFamily: MONO };
function Field({ label, children }) { return <div style={{ width: "100%" }}><label style={labelStyle}>{label}</label>{children}</div>; }
function selectStyle(filled, alert) {
  return { width: "100%", border: `2px solid ${alert ? ORANGE : filled ? NAVY : BORDER}`, borderRadius: 10, padding: "11px 12px", fontSize: 13, fontWeight: 700, color: alert ? ORANGE : filled ? INK : MUTED, outline: "none", background: FIELD_BG, appearance: "auto", fontFamily: MONO, boxSizing: "border-box" };
}
function TextBtn({ onClick, color = MUTED, children }) {
  return <button onClick={onClick} style={{ background: "none", border: "none", padding: "0 2px", color, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: MONO, minHeight: 44, display: "flex", alignItems: "center" }}>{children}</button>;
}

export default function RenovaGrilla() {
  const [store, setStore] = useState(MOCK);
  const [activa, setActiva] = useState(null);      // pos de fila activa (resaltado)
  const [detalle, setDetalle] = useState(null);    // pos con sheet abierto
  const [flash, setFlash] = useState(false);
  const [modeloManual, setModeloManual] = useState(false);
  const [reencaucheSec, setReencaucheSec] = useState(false);

  const fieldRefs = useRef({});
  const reg = (p, f) => (el) => { fieldRefs.current[`${p}-${f}`] = el; };
  const orden = FILAS.flatMap((p) => CELDAS.map((f) => `${p}-${f}`));

  const rec = (p) => store[p] || empty();
  const flashSave = () => { setFlash(true); clearTimeout(window.__rf); window.__rf = setTimeout(() => setFlash(false), 1200); };
  const upd = (p, f, v) => { setStore((s) => ({ ...s, [p]: { ...(s[p] || empty()), [f]: v } })); flashSave(); };
  const setField = (p, f) => (e) => upd(p, f, e.target.value);
  const selectAll = (e) => e.target.select();

  const onEnter = (p, f) => (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const i = orden.indexOf(`${p}-${f}`);
    if (i >= 0 && i < orden.length - 1) fieldRefs.current[orden[i + 1]]?.focus();
    else fieldRefs.current[`${p}-${f}`]?.blur();
  };

  const completa = (p) => { const d = rec(p); return !!(d.r1 && d.r2 && d.r3 && d.r4 && d.presion); };
  const empezada = (p) => { const d = rec(p); return !!(d.r1 || d.r2 || d.r3 || d.r4 || d.presion); };
  const listas = FILAS.filter(completa).length;

  const setMarca = (p) => (e) => {
    const marca = e.target.value;
    const valido = modelosDe(marca).includes(rec(p).modeloNeumatico);
    setModeloManual(false);
    setStore((s) => ({ ...s, [p]: { ...(s[p] || empty()), marca, modeloNeumatico: valido ? rec(p).modeloNeumatico : "" } }));
    flashSave();
  };
  const openDetalle = (p) => { setDetalle(p); setModeloManual(false); setReencaucheSec(!!(rec(p).modeloActual || rec(p).reencauche)); };
  const dd = detalle != null ? rec(detalle) : empty();
  const showReencauche = reencaucheSec || !!(dd.modeloActual || dd.reencauche);

  // Estado de fila → color de la barra lateral
  const barColor = (p) => p === activa ? ORANGE : completa(p) ? NAVY : empezada(p) ? YELLOW : BORDER;

  const Cell = (p, f) => {
    const d = rec(p);
    const filled = d[f] !== "";
    const esPsi = f === "presion";
    return (
      <input
        ref={reg(p, f)} type="number" inputMode="numeric"
        value={d[f]} onChange={setField(p, f)} onFocus={(e) => { selectAll(e); setActiva(p); }} onKeyDown={onEnter(p, f)}
        placeholder="·"
        style={{
          width: "100%", height: 46, border: "none", outline: "none", textAlign: "center",
          fontSize: 18, fontWeight: 800, color: filled ? INK : "#cfd6e2",
          background: p === activa ? "#fff" : (esPsi ? "#fbfcfe" : "transparent"),
          fontFamily: MONO, fontVariantNumeric: "tabular-nums", boxSizing: "border-box",
          borderLeft: esPsi ? `1px solid ${BORDER}` : "none",
        }}
      />
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: "#cbd5e1", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: MONO }}>
      <div style={{ width: "min(410px, 100%)", height: "min(820px, 96vh)", background: "#eef1f6", borderRadius: 26, overflow: "hidden", boxShadow: "0 24px 64px rgba(21,35,63,0.30)", display: "flex", flexDirection: "column", position: "relative" }}>

        {/* App bar */}
        <div style={{ background: NAVY, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <button aria-label="Volver" style={{ background: "none", border: "none", color: "rgba(255,255,255,0.9)", fontSize: 22, cursor: "pointer", minWidth: 44, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>←</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>Unidad 2104</div>
            <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 2, display: "flex", gap: 8 }}>
              <span>Móvil Bus · 2-4-2</span>
              {flash && <span style={{ color: YELLOW, fontWeight: 700, fontSize: 11 }}>✓ Guardado</span>}
            </div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.12)", borderRadius: 9, padding: "6px 11px", textAlign: "center" }}>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 9, fontWeight: 800, letterSpacing: "0.08em" }}>LISTAS</div>
            <div style={{ color: "#fff", fontSize: 16, fontWeight: 900, lineHeight: 1.1 }}>{listas}<span style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>/8</span></div>
          </div>
        </div>

        {/* Encabezado de columnas (sticky) */}
        <div style={{ display: "grid", gridTemplateColumns: "92px 1fr 1fr 1fr 1fr 1fr", alignItems: "center", background: "#e6eaf1", borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: MUTED, letterSpacing: "0.1em", padding: "8px 0 8px 14px" }}>LLANTA</div>
          {["R1", "R2", "R3", "R4"].map((h) => <div key={h} style={{ fontSize: 11, fontWeight: 800, color: MUTED, textAlign: "center", padding: "8px 0" }}>{h}</div>)}
          <div style={{ fontSize: 11, fontWeight: 800, color: NAVY, textAlign: "center", padding: "8px 0", borderLeft: `1px solid ${BORDER}` }}>PSI</div>
        </div>

        {/* Grilla — todas las llantas */}
        <div style={{ flex: 1, overflowY: "auto", background: "#fff" }}>
          {FILAS.map((p, idx) => {
            const d = rec(p);
            const anomalia = !!d.anomalia;
            const valvulaMal = d.tapaValvula !== "" && d.tapaValvula !== "OK";
            return (
              <div key={p} style={{ display: "grid", gridTemplateColumns: "92px 1fr 1fr 1fr 1fr 1fr", alignItems: "stretch", borderBottom: `1px solid #eef1f6`, background: p === activa ? "#fff8f4" : "#fff", position: "relative" }}>
                {/* Barra de estado */}
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: barColor(p) }} />
                {/* Identidad de la llanta → abre detalle */}
                <button onClick={() => openDetalle(p)} style={{ background: "none", border: "none", borderRight: `1px solid #eef1f6`, padding: "6px 6px 6px 12px", display: "flex", flexDirection: "column", justifyContent: "center", cursor: "pointer", fontFamily: MONO, textAlign: "left", minHeight: 52, gap: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ fontSize: 16, fontWeight: 900, color: NAVY, lineHeight: 1 }}>{p}</span>
                    {anomalia && <span title="Anomalía" style={{ width: 7, height: 7, borderRadius: "50%", background: ORANGE }} />}
                    {valvulaMal && <span title="Válvula" style={{ width: 7, height: 7, borderRadius: "50%", background: YELLOW }} />}
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, color: MUTED, lineHeight: 1.1 }}>{POS[p].etq}</span>
                  <span style={{ fontSize: 8.5, color: d.codigo ? "#9aa4b6" : "#cfd6e2", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 76 }}>{d.codigo || "sin código"}</span>
                </button>
                {/* Celdas de medición */}
                {Cell(p, "r1")}{Cell(p, "r2")}{Cell(p, "r3")}{Cell(p, "r4")}{Cell(p, "presion")}
              </div>
            );
          })}

          {/* Leyenda compacta */}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", padding: "12px 14px 4px", justifyContent: "center" }}>
            {[["Lista", NAVY], ["A medias", YELLOW], ["Pendiente", BORDER]].map(([t, c]) => (
              <span key={t} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: MUTED }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: c }} /> {t}
              </span>
            ))}
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: MUTED }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: ORANGE }} /> Anomalía
            </span>
          </div>
        </div>

        {/* Barra inferior */}
        <div style={{ flexShrink: 0, padding: 12, background: "#eef1f6", borderTop: `1px solid ${BORDER}` }}>
          <button style={{ width: "100%", background: listas === 8 ? GREEN : NAVY, color: "#fff", border: "none", borderRadius: 14, padding: "15px", fontWeight: 800, fontSize: 15, letterSpacing: "0.04em", cursor: "pointer", fontFamily: MONO }}>
            {listas === 8 ? "FINALIZAR INSPECCIÓN ✓" : `FINALIZAR · faltan ${8 - listas}`}
          </button>
        </div>

        {/* ── Detalle de la llanta (código + datos + válvula + anomalía) ── */}
        {detalle != null && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(10,16,30,0.5)", display: "flex", alignItems: "flex-end", zIndex: 50 }} onClick={() => setDetalle(null)}>
            <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "18px 18px 26px", maxHeight: "92%", overflowY: "auto", boxSizing: "border-box" }} onClick={(e) => e.stopPropagation()}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: BORDER, margin: "0 auto 16px" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <span style={{ background: NAVY, color: "#fff", fontWeight: 900, fontSize: 18, width: 38, height: 38, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>{detalle}</span>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 15, color: NAVY }}>Llanta {detalle}</div>
                  <div style={{ fontSize: 12, color: MUTED }}>{POS[detalle].etq}</div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Código */}
                <Field label="CÓDIGO DE NEUMÁTICO">
                  <div style={{ border: `2px solid ${dd.codigo ? NAVY : BORDER}`, borderRadius: 10, display: "flex", alignItems: "center", padding: "0 12px", background: FIELD_BG }}>
                    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" style={{ marginRight: 8, flexShrink: 0 }} aria-hidden="true">
                      <circle cx="7.5" cy="7.5" r="5" stroke="#9aa4b6" strokeWidth="2" /><path d="M11.5 11.5L16 16" stroke="#9aa4b6" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <input value={dd.codigo} onChange={setField(detalle, "codigo")} onFocus={selectAll} placeholder="Escanear o ingresar código"
                      style={{ flex: 1, border: "none", outline: "none", fontSize: 18, fontWeight: 800, color: INK, padding: "12px 0", background: "transparent", fontFamily: MONO, letterSpacing: "0.02em" }} />
                  </div>
                </Field>

                {/* Datos */}
                <Field label="MARCA">
                  <select value={dd.marca} onChange={setMarca(detalle)} style={selectStyle(dd.marca, false)}>
                    <option value="">Seleccionar marca…</option>{MARCAS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </Field>
                <div style={{ width: "100%" }}>
                  <label style={labelStyle}>MODELO</label>
                  {modeloManual ? (
                    <>
                      <input value={dd.modeloNeumatico} onChange={setField(detalle, "modeloNeumatico")} autoFocus placeholder="Escribe el modelo…"
                        style={{ width: "100%", border: `2px solid ${dd.modeloNeumatico ? NAVY : ORANGE}`, borderRadius: 10, padding: "11px 12px", fontSize: 13, fontWeight: 700, color: INK, outline: "none", background: FIELD_BG, fontFamily: MONO, boxSizing: "border-box" }} />
                      <TextBtn onClick={() => { setModeloManual(false); upd(detalle, "modeloNeumatico", ""); }}>← Volver a la lista</TextBtn>
                    </>
                  ) : (
                    <>
                      <select value={dd.modeloNeumatico} onChange={setField(detalle, "modeloNeumatico")} disabled={!dd.marca}
                        style={{ ...selectStyle(dd.modeloNeumatico, false), opacity: dd.marca ? 1 : 0.55 }}>
                        <option value="">{dd.marca ? "Seleccionar modelo…" : "Primero elige marca"}</option>{modelosDe(dd.marca).map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                      {dd.marca && <TextBtn onClick={() => { setModeloManual(true); upd(detalle, "modeloNeumatico", ""); }} color={ORANGE}>+ Agregar modelo nuevo</TextBtn>}
                    </>
                  )}
                </div>
                {showReencauche ? (
                  <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 10 }}>
                    <Field label="MODELO ACTUAL">
                      <select value={dd.modeloActual} onChange={setField(detalle, "modeloActual")} disabled={!dd.marca} style={{ ...selectStyle(dd.modeloActual, false), opacity: dd.marca ? 1 : 0.55 }}>
                        <option value="">{dd.marca ? "Seleccionar…" : "Elige marca"}</option>{modelosDe(dd.marca).map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </Field>
                    <Field label="REENC."><select value={dd.reencauche} onChange={setField(detalle, "reencauche")} style={selectStyle(dd.reencauche, false)}><option value="">—</option>{REENCAUCHES.map((r) => <option key={r} value={r}>{r}</option>)}</select></Field>
                  </div>
                ) : (
                  <button onClick={() => setReencaucheSec(true)} style={{ background: "none", border: `1px dashed ${BORDER}`, borderRadius: 10, padding: "10px 14px", color: MUTED, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: MONO, width: "100%", textAlign: "left", minHeight: 44 }}>+ Tiene reencauche</button>
                )}
                <Field label="MEDIDA">
                  <select value={dd.medida} onChange={setField(detalle, "medida")} style={selectStyle(dd.medida, false)}><option value="">Seleccionar medida…</option>{MEDIDAS.map((m) => <option key={m} value={m}>{m}</option>)}</select>
                </Field>

                {/* Válvula + Anomalía */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <Field label="VÁLVULA">
                    <select value={dd.tapaValvula} onChange={setField(detalle, "tapaValvula")} style={selectStyle(dd.tapaValvula, dd.tapaValvula !== "" && dd.tapaValvula !== "OK")}><option value="">—</option>{VALVULA.map((o) => <option key={o} value={o}>{o}</option>)}</select>
                  </Field>
                  <Field label="ANOMALÍA">
                    <select value={dd.anomalia} onChange={setField(detalle, "anomalia")} style={selectStyle(dd.anomalia, !!dd.anomalia)}><option value="">Ninguna</option>{ANOMALIAS.map((o) => <option key={o} value={o}>{o}</option>)}</select>
                  </Field>
                </div>
              </div>

              <button onClick={() => setDetalle(null)} style={{ width: "100%", background: NAVY, color: "#fff", border: "none", borderRadius: 12, padding: 14, fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: MONO, marginTop: 20, minHeight: 52 }}>Listo</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
