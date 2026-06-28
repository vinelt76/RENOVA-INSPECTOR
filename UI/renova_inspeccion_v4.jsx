import { useState, useRef } from "react";

const MONO = '"JetBrains Mono", "IBM Plex Mono", "SFMono-Regular", Menlo, monospace';
const NAVY   = "#15233f";
const ORANGE = "#e85420";
const YELLOW = "#f4b821";
const INK    = "#15233f";
const BORDER = "#c7d0de";
const FIELD_BG = "#f6f8fb";
const MUTED  = "#7b879c";

const MARCAS = ["Michelin", "Bridgestone", "Continental", "Pirelli", "Goodyear", "Firestone", "Hankook", "Yokohama", "Dunlop", "Triangle"];
const MODELOS_POR_MARCA = {
  Michelin:    ["XDA2+", "X Multi Z", "XZE2+", "X Multi D"],
  Bridgestone: ["M729", "R168", "M788", "G611", "Ecopia H-Drive"],
  Continental: ["HDR2", "HSR2", "Conti Hybrid HD3"],
  Pirelli:     ["TH01", "FR01", "FG01", "TR01"],
  Goodyear:    ["G286", "G287", "Marathon LHS"],
  Firestone:   ["FS591", "FS400", "FD691"],
  Hankook:     ["DH05", "AH11", "TH22"],
  Yokohama:    ["101ZL", "TY517", "RY023"],
  Dunlop:      ["SP320", "SP431", "SP160"],
  Triangle:    ["TR685", "TRS02", "TR689A"],
};
const modelosDe = (marca) => MODELOS_POR_MARCA[marca] || [];

const REENCAUCHES = ["R1", "R2", "R3", "R4"];
const MEDIDAS     = ["295/80 R22.5", "315/80 R22.5", "275/70 R22.5", "385/65 R22.5", "11R22.5", "12R22.5", "10R22.5"];
const ANOMALIAS   = ["Corte lateral", "Burbuja", "Desgaste irregular", "Banda separada", "Daño en talón", "Separación de capas", "Otro"];
const VALVULA     = ["OK", "Falta", "Dañada", "Sucia", "Reemplazar"];

// ── Configuración 2-4-2 — la columna vertebral ──────────────────────────────
// Numeración fija de flota + recorrido físico de inspección.
const POS = {
  1: { eje: 1, grupo: "Direccional", lado: "Izq", tipo: "single", tag: "DIR" },
  2: { eje: 1, grupo: "Direccional", lado: "Der", tipo: "single", tag: "DIR" },
  3: { eje: 2, grupo: "Tracción",    lado: "Izq", tipo: "ext",    tag: "EXT" },
  4: { eje: 2, grupo: "Tracción",    lado: "Izq", tipo: "int",    tag: "INT" },
  5: { eje: 2, grupo: "Tracción",    lado: "Der", tipo: "int",    tag: "INT" },
  6: { eje: 2, grupo: "Tracción",    lado: "Der", tipo: "ext",    tag: "EXT" },
  7: { eje: 3, grupo: "Libre",       lado: "Izq", tipo: "single", tag: "LIB" },
  8: { eje: 3, grupo: "Libre",       lado: "Der", tipo: "single", tag: "LIB" },
};
const RECORRIDO = [1, 3, 4, 7, 8, 6, 5, 2];   // izquierda ↓ · atrás → · derecha ↑
const TOTAL = RECORRIDO.length;

const labelFisico = (n) => {
  const p = POS[n];
  const ext = p.tipo === "ext" ? " ext." : p.tipo === "int" ? " int." : "";
  return `${p.grupo} ${p.lado.toLowerCase()}${ext}`;
};

const empty = () => ({
  codigo: "", r1: "", r2: "", r3: "", r4: "",
  presion: "", tapaValvula: "", anomalia: "",
  marca: "", modeloNeumatico: "", modeloActual: "", reencauche: "", medida: "",
});

// Mock — pos 1 ya inspeccionada; pos 3 actual, solo con catálogo heredado
const MOCK = {
  1: { codigo: "MIC-2104-01", r1: "12", r2: "11", r3: "12", r4: "13", presion: "110", tapaValvula: "OK", anomalia: "", marca: "Michelin",    modeloNeumatico: "XDA2+", modeloActual: "XDA2+", reencauche: "R2", medida: "295/80 R22.5" },
  3: { codigo: "BRI-2104-03", r1: "",   r2: "",   r3: "",   r4: "",   presion: "",    tapaValvula: "",   anomalia: "", marca: "Bridgestone", modeloNeumatico: "M729",  modeloActual: "M729",  reencauche: "R1", medida: "295/80 R22.5" },
};

const labelStyle = { fontSize: 11, fontWeight: 800, color: MUTED, letterSpacing: "0.12em", display: "block", marginBottom: 6, fontFamily: MONO };

function Field({ label, children }) {
  return (
    <div style={{ width: "100%" }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function selectStyle(filled, alert) {
  return {
    width: "100%",
    border: `2px solid ${alert ? ORANGE : filled ? NAVY : BORDER}`,
    borderRadius: 10, padding: "11px 12px", fontSize: 13, fontWeight: 700,
    color: alert ? ORANGE : filled ? INK : MUTED, outline: "none",
    background: FIELD_BG, appearance: "auto", fontFamily: MONO, boxSizing: "border-box",
  };
}

function TextBtn({ onClick, color = MUTED, children }) {
  return (
    <button onClick={onClick} style={{ background: "none", border: "none", padding: "0 2px", color, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: MONO, letterSpacing: "0.02em", minHeight: 44, display: "flex", alignItems: "center" }}>
      {children}
    </button>
  );
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

// Llanta del carrito panorámico
function WheelBtn({ n, tag, state, onClick }) {
  const isCur = state === "current";
  const isDone = state === "done";
  const bg = isCur ? ORANGE : isDone ? NAVY : "#fff";
  const fg = isCur || isDone ? "#fff" : MUTED;
  const bd = isCur ? ORANGE : isDone ? NAVY : BORDER;
  return (
    <button
      onClick={onClick}
      style={{ width: 46, height: 54, borderRadius: 9, background: bg, border: `2px solid ${bd}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, cursor: "pointer", fontFamily: MONO, flexShrink: 0, transition: "background 0.12s" }}
    >
      <span style={{ fontSize: 17, fontWeight: 900, color: fg, lineHeight: 1 }}>{n}</span>
      <span style={{ fontSize: 7.5, fontWeight: 800, color: isCur || isDone ? "rgba(255,255,255,0.7)" : MUTED, letterSpacing: "0.04em" }}>{tag}</span>
    </button>
  );
}

export default function RenovaInspeccion() {
  const [store, setStore]           = useState(MOCK);
  const [pos, setPos]               = useState(3);
  const [data, setData]             = useState(MOCK[3] || empty());
  const [showSheet, setShowSheet]   = useState(false);
  const [showPos, setShowPos]       = useState(false);
  const [flash, setFlash]           = useState(false);
  const [modeloManual, setModeloManual] = useState(false);
  const [reencaucheSec, setReencaucheSec] = useState(!!(MOCK[3]?.modeloActual || MOCK[3]?.reencauche));

  const [codigoEditing, setCodigoEditing] = useState(false);
  const codigoRef = useRef(null);
  const enterCodigoEdit = () => { setCodigoEditing(true); setTimeout(() => codigoRef.current?.focus(), 10); };

  const r1Ref = useRef(null), r2Ref = useRef(null), r3Ref = useRef(null), r4Ref = useRef(null);
  const remRefs = { r1: r1Ref, r2: r2Ref, r3: r3Ref, r4: r4Ref };
  const remNext = { r1: "r2", r2: "r3", r3: "r4", r4: null };
  const handleRemKey = (key) => (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const nk = remNext[key];
      if (nk) remRefs[nk].current?.focus();
      else     remRefs[key].current?.blur();
    }
  };

  const selectAll = (e) => e.target.select();

  const commit = (next) => {
    setData(next);
    setStore((s) => ({ ...s, [pos]: next }));
    setFlash(true);
    clearTimeout(window.__renovaFlash);
    window.__renovaFlash = setTimeout(() => setFlash(false), 1400);
  };
  const set = (field) => (e) => commit({ ...data, [field]: e.target.value });

  const setMarca = (e) => {
    const marca = e.target.value;
    const valido = modelosDe(marca).includes(data.modeloNeumatico);
    setModeloManual(false);
    commit({ ...data, marca, modeloNeumatico: valido ? data.modeloNeumatico : "" });
  };

  const switchPos = (n) => {
    setStore((s) => ({ ...s, [pos]: data }));
    const nextData = store[n] || empty();
    setPos(n);
    setData(nextData);
    setShowPos(false);
    setModeloManual(false);
    setReencaucheSec(!!(nextData.modeloActual || nextData.reencauche));
    setCodigoEditing(false);
  };

  // Inspeccionada = tiene datos de campo (remanente/presión), no solo catálogo heredado
  const inspeccionada = (n) => {
    const d = n === pos ? data : store[n];
    return !!(d && (d.r1 || d.r2 || d.r3 || d.r4 || d.presion));
  };

  const idx        = RECORRIDO.indexOf(pos);
  const nextPos    = idx >= 0 && idx < TOTAL - 1 ? RECORRIDO[idx + 1] : null;
  const esUltima   = nextPos === null;
  const hechas     = RECORRIDO.filter(inspeccionada).length;

  const valvulaAlert   = data.tapaValvula !== "" && data.tapaValvula !== "OK";
  const anomaliaAlert  = data.anomalia !== "";
  const showReencauche = reencaucheSec || !!(data.modeloActual || data.reencauche);
  const tieneUltimaInsp = !!(data.r1 || data.r2 || data.r3 || data.r4 || data.presion);

  const datosResumen =
    [data.marca, data.modeloNeumatico, data.medida, data.reencauche].filter(Boolean).join(" · ") ||
    "Marca, modelo, medida, reencauche…";

  const remCell = (key, label) => {
    const filled = data[key] !== "";
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: MUTED, letterSpacing: "0.08em" }}>{label}</span>
        <div style={{ height: 68, border: `2px solid ${filled ? NAVY : BORDER}`, borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#fff", transition: "border-color 0.15s" }}>
          <input
            ref={remRefs[key]}
            type="number" inputMode="numeric"
            value={data[key]} onChange={set(key)} onFocus={selectAll} onKeyDown={handleRemKey(key)}
            placeholder="—"
            style={{ width: "100%", border: "none", outline: "none", textAlign: "center", fontSize: 22, fontWeight: 800, color: INK, padding: "4px 4px 0", background: "transparent", fontVariantNumeric: "tabular-nums", fontFamily: MONO }}
          />
          <span style={{ fontSize: 10, color: MUTED, fontWeight: 700, paddingBottom: 4 }}>mm</span>
        </div>
      </div>
    );
  };

  // Estado de una llanta para el carrito
  const wheelState = (n) => (n === pos ? "current" : inspeccionada(n) ? "done" : "pending");
  const W = (n) => <WheelBtn n={n} tag={POS[n].tag} state={wheelState(n)} onClick={() => switchPos(n)} />;

  return (
    <div style={{ minHeight: "100vh", background: "#cbd5e1", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: MONO }}>
      <div style={{ width: "min(410px, 100%)", height: "min(820px, 96vh)", background: "#eef1f6", borderRadius: 26, overflow: "hidden", boxShadow: "0 24px 64px rgba(21,35,63,0.30)", display: "flex", flexDirection: "column", position: "relative" }}>

        {/* App bar */}
        <div style={{ background: NAVY, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <button aria-label="Volver" style={{ background: "none", border: "none", color: "rgba(255,255,255,0.9)", fontSize: 22, cursor: "pointer", fontFamily: "monospace", minWidth: 44, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", padding: 0, flexShrink: 0 }}>←</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 15, letterSpacing: "-0.01em" }}>Inspección</div>
            <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 2, display: "flex", gap: 8, alignItems: "center" }}>
              <span>Móvil Bus · Unidad 2104</span>
              {flash && <span style={{ color: YELLOW, fontWeight: 700, fontSize: 11 }}>✓ Guardado</span>}
            </div>
          </div>
          <StepDots current={3} />
          {/* Botón posición → abre el carrito panorámico */}
          <button
            onClick={() => setShowPos(true)}
            style={{ background: ORANGE, border: "none", borderRadius: 9, padding: "5px 12px", display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", flexShrink: 0, fontFamily: MONO, minHeight: 44, justifyContent: "center" }}
          >
            <span style={{ color: "rgba(255,255,255,0.75)", fontSize: 9, fontWeight: 800, letterSpacing: "0.08em" }}>POS.</span>
            <span style={{ color: "#fff", fontSize: 18, fontWeight: 900, lineHeight: 1.1 }}>{pos}</span>
          </button>
        </div>

        {/* Scroll body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>

          {/* Código — hero display */}
          <div style={{ background: "#fff", borderRadius: 14, padding: 14 }}>
            <Field label="CÓDIGO DE NEUMÁTICO">
              {data.codigo && !codigoEditing ? (
                <button onClick={enterCodigoEdit} style={{ width: "100%", background: NAVY, border: "none", borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", fontFamily: MONO, minHeight: 56, boxSizing: "border-box" }}>
                  <span style={{ fontSize: 26, fontWeight: 900, color: "#fff", letterSpacing: "0.04em", fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>{data.codigo}</span>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 700, letterSpacing: "0.08em" }}>EDITAR</span>
                </button>
              ) : (
                <div style={{ border: `2px solid ${data.codigo ? NAVY : BORDER}`, borderRadius: 10, display: "flex", alignItems: "center", padding: "0 12px", background: FIELD_BG, transition: "border-color 0.15s" }}>
                  <svg width="16" height="16" viewBox="0 0 18 18" fill="none" style={{ marginRight: 8, flexShrink: 0 }} aria-hidden="true">
                    <circle cx="7.5" cy="7.5" r="5" stroke="#9aa4b6" strokeWidth="2" />
                    <path d="M11.5 11.5L16 16" stroke="#9aa4b6" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <input
                    ref={codigoRef}
                    value={data.codigo} onChange={set("codigo")} onFocus={selectAll}
                    onBlur={() => { if (data.codigo) setCodigoEditing(false); }}
                    onKeyDown={(e) => { if (e.key === "Enter" && data.codigo) { e.preventDefault(); setCodigoEditing(false); } }}
                    placeholder="Escanear o ingresar código"
                    style={{ flex: 1, border: "none", outline: "none", fontSize: 18, fontWeight: 700, color: INK, padding: "12px 0", background: "transparent", fontFamily: MONO }}
                  />
                </div>
              )}
            </Field>
          </div>

          {/* Datos del neumático */}
          <button onClick={() => setShowSheet(true)} style={{ background: "#fff", border: `2px solid ${data.marca ? NAVY : BORDER}`, borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", width: "100%", textAlign: "left", fontFamily: MONO, gap: 10, minHeight: 60 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: NAVY }}>Datos del neumático</div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{datosResumen}</div>
            </div>
            <span style={{ color: ORANGE, fontSize: 20, fontWeight: 800, flexShrink: 0 }}>›</span>
          </button>

          {/* Remanente */}
          <div style={{ background: "#fff", borderRadius: 14, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: MUTED, letterSpacing: "0.12em" }}>REMANENTE (mm)</span>
              {tieneUltimaInsp && (
                <span style={{ fontSize: 9, fontWeight: 800, color: ORANGE, background: "#fdece4", padding: "3px 7px", borderRadius: 5, letterSpacing: "0.06em" }}>ULT. INSP.</span>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {remCell("r1", "R1")}{remCell("r2", "R2")}{remCell("r3", "R3")}{remCell("r4", "R4")}
            </div>
          </div>

          {/* Presión + Válvula */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignItems: "start" }}>
            <div style={{ background: "#fff", borderRadius: 14, padding: 14 }}>
              <Field label="PRESIÓN">
                <div style={{ height: 52, border: `2px solid ${data.presion ? NAVY : BORDER}`, borderRadius: 10, display: "flex", alignItems: "center", padding: "0 12px", background: FIELD_BG, boxSizing: "border-box", transition: "border-color 0.15s" }}>
                  <input type="number" inputMode="numeric" value={data.presion} onChange={set("presion")} onFocus={selectAll} placeholder="—"
                    style={{ flex: 1, minWidth: 0, width: "100%", border: "none", outline: "none", fontSize: 24, fontWeight: 800, color: INK, padding: 0, background: "transparent", fontVariantNumeric: "tabular-nums", fontFamily: MONO }} />
                  <span style={{ fontSize: 11, color: MUTED, fontWeight: 700, marginLeft: 6, flexShrink: 0 }}>psi</span>
                </div>
              </Field>
            </div>
            <div style={{ background: "#fff", borderRadius: 14, padding: 14 }}>
              <Field label="VÁLVULA">
                <select value={data.tapaValvula} onChange={set("tapaValvula")} style={{ ...selectStyle(data.tapaValvula, valvulaAlert), height: 52 }}>
                  <option value="">—</option>
                  {VALVULA.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
            </div>
          </div>

          {/* Anomalía */}
          <div style={{ background: anomaliaAlert ? "#fff9f6" : "#fff", borderRadius: 14, padding: 14, border: anomaliaAlert ? `2px solid ${ORANGE}` : "2px solid transparent", transition: "border-color 0.15s, background 0.15s" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: MUTED, letterSpacing: "0.12em" }}>ANOMALÍA</span>
              {anomaliaAlert && <span style={{ fontSize: 9, fontWeight: 800, color: ORANGE, background: "#fdece4", padding: "2px 7px", borderRadius: 4, letterSpacing: "0.06em" }}>⚠ ACTIVA</span>}
            </div>
            <select value={data.anomalia} onChange={set("anomalia")} style={{ ...selectStyle(data.anomalia, anomaliaAlert), height: 52 }}>
              <option value="">Ninguna</option>
              {ANOMALIAS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          {/* CTA — avanza según el recorrido */}
          <button
            onClick={() => { if (nextPos) switchPos(nextPos); }}
            style={{ background: esUltima ? NAVY : ORANGE, color: "#fff", border: "none", borderRadius: 14, padding: "16px", fontWeight: 800, fontSize: 15, letterSpacing: "0.04em", cursor: "pointer", fontFamily: MONO, marginTop: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            {esUltima ? "GUARDAR Y FINALIZAR ✓" : `GUARDAR Y SIGUIENTE → POS. ${nextPos}`}
          </button>
        </div>

        {/* ── Sheet: Datos del neumático ── */}
        {showSheet && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(10,16,30,0.5)", display: "flex", alignItems: "flex-end", zIndex: 50 }} onClick={() => setShowSheet(false)}>
            <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "18px 18px 26px", maxHeight: "90%", overflowY: "auto", boxSizing: "border-box" }} onClick={(e) => e.stopPropagation()}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: BORDER, margin: "0 auto 18px" }} />
              <div style={{ fontWeight: 900, fontSize: 16, color: NAVY, marginBottom: 18 }}>Datos del neumático</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <Field label="MARCA DE NEUMÁTICO">
                  <select value={data.marca} onChange={setMarca} style={selectStyle(data.marca, false)}>
                    <option value="">Seleccionar marca…</option>
                    {MARCAS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </Field>
                <div style={{ width: "100%" }}>
                  <label style={labelStyle}>MODELO DE NEUMÁTICO</label>
                  {modeloManual ? (
                    <>
                      <input value={data.modeloNeumatico} onChange={set("modeloNeumatico")} autoFocus placeholder="Escribe el modelo…"
                        style={{ width: "100%", border: `2px solid ${data.modeloNeumatico ? NAVY : ORANGE}`, borderRadius: 10, padding: "11px 12px", fontSize: 13, fontWeight: 700, color: INK, outline: "none", background: FIELD_BG, fontFamily: MONO, boxSizing: "border-box" }} />
                      <TextBtn onClick={() => { setModeloManual(false); commit({ ...data, modeloNeumatico: "" }); }} color={MUTED}>← Volver a la lista</TextBtn>
                    </>
                  ) : (
                    <>
                      <select value={data.modeloNeumatico} onChange={set("modeloNeumatico")} disabled={!data.marca}
                        style={{ ...selectStyle(data.modeloNeumatico, false), opacity: data.marca ? 1 : 0.55, cursor: data.marca ? "pointer" : "not-allowed" }}>
                        <option value="">{data.marca ? "Seleccionar modelo…" : "Primero elige una marca"}</option>
                        {modelosDe(data.marca).map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                      {data.marca && <TextBtn onClick={() => { setModeloManual(true); commit({ ...data, modeloNeumatico: "" }); }} color={ORANGE}>+ ¿No está el modelo? Agregar nuevo</TextBtn>}
                    </>
                  )}
                </div>
                {showReencauche ? (
                  <div>
                    <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 10 }}>
                      <Field label="MODELO ACTUAL">
                        <select value={data.modeloActual} onChange={set("modeloActual")} disabled={!data.marca}
                          style={{ ...selectStyle(data.modeloActual, false), opacity: data.marca ? 1 : 0.55, cursor: data.marca ? "pointer" : "not-allowed" }}>
                          <option value="">{data.marca ? "Seleccionar…" : "Elige marca"}</option>
                          {modelosDe(data.marca).map((m) => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </Field>
                      <Field label="REENCAUCHE">
                        <select value={data.reencauche} onChange={set("reencauche")} style={selectStyle(data.reencauche, false)}>
                          <option value="">—</option>
                          {REENCAUCHES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </Field>
                    </div>
                    {reencaucheSec && !data.modeloActual && !data.reencauche && (
                      <TextBtn onClick={() => setReencaucheSec(false)} color={MUTED}>← Quitar reencauche</TextBtn>
                    )}
                  </div>
                ) : (
                  <button onClick={() => setReencaucheSec(true)} style={{ background: "none", border: `1px dashed ${BORDER}`, borderRadius: 10, padding: "10px 14px", color: MUTED, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: MONO, width: "100%", textAlign: "left", letterSpacing: "0.02em", minHeight: 44 }}>
                    + Este neumático tiene reencauche
                  </button>
                )}
                <Field label="MEDIDA">
                  <select value={data.medida} onChange={set("medida")} style={selectStyle(data.medida, false)}>
                    <option value="">Seleccionar medida…</option>
                    {MEDIDAS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </Field>
              </div>
              <button onClick={() => setShowSheet(false)} style={{ width: "100%", background: NAVY, color: "#fff", border: "none", borderRadius: 12, padding: 14, fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: MONO, marginTop: 20, minHeight: 52 }}>Listo</button>
            </div>
          </div>
        )}

        {/* ── Sheet: Carrito panorámico ── */}
        {showPos && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(10,16,30,0.55)", display: "flex", alignItems: "flex-end", zIndex: 60 }} onClick={() => setShowPos(false)}>
            <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "18px 18px 26px", boxSizing: "border-box" }} onClick={(e) => e.stopPropagation()}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: BORDER, margin: "0 auto 16px" }} />
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 2 }}>
                <div style={{ fontWeight: 900, fontSize: 15, color: NAVY }}>Mapa de la unidad</div>
                <div style={{ fontSize: 11, fontWeight: 800, color: ORANGE }}>{hechas} / {TOTAL} listas</div>
              </div>
              <div style={{ fontSize: 12, color: MUTED, marginBottom: 14 }}>Unidad 2104 · 2-4-2 · toca una llanta para ir</div>

              {/* Vista de planta del vehículo */}
              <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 20, padding: "6px 0 2px" }}>
                {/* Chasis */}
                <div style={{ position: "absolute", top: 30, bottom: 12, width: 50, background: NAVY, borderRadius: 16, left: "50%", transform: "translateX(-50%)", zIndex: 0, opacity: 0.92 }} />
                <div style={{ fontSize: 9, fontWeight: 800, color: MUTED, letterSpacing: "0.22em", zIndex: 1 }}>▲ FRENTE</div>

                {/* Eje 1 — direccional */}
                <div style={{ display: "flex", alignItems: "center", width: "100%", zIndex: 1 }}>
                  <div style={{ flex: 1, display: "flex", justifyContent: "flex-end", gap: 6 }}>{W(1)}</div>
                  <div style={{ width: 54, flexShrink: 0 }} />
                  <div style={{ flex: 1, display: "flex", justifyContent: "flex-start", gap: 6 }}>{W(2)}</div>
                </div>

                {/* Eje 2 — tracción (dual) */}
                <div style={{ display: "flex", alignItems: "center", width: "100%", zIndex: 1 }}>
                  <div style={{ flex: 1, display: "flex", justifyContent: "flex-end", gap: 6 }}>{W(3)}{W(4)}</div>
                  <div style={{ width: 54, flexShrink: 0 }} />
                  <div style={{ flex: 1, display: "flex", justifyContent: "flex-start", gap: 6 }}>{W(5)}{W(6)}</div>
                </div>

                {/* Eje 3 — libre */}
                <div style={{ display: "flex", alignItems: "center", width: "100%", zIndex: 1 }}>
                  <div style={{ flex: 1, display: "flex", justifyContent: "flex-end", gap: 6 }}>{W(7)}</div>
                  <div style={{ width: 54, flexShrink: 0 }} />
                  <div style={{ flex: 1, display: "flex", justifyContent: "flex-start", gap: 6 }}>{W(8)}</div>
                </div>
              </div>

              {/* Leyenda */}
              <div style={{ marginTop: 18, display: "flex", gap: 16, justifyContent: "center" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: MUTED }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: ORANGE }} /> Actual
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: MUTED }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: NAVY }} /> Inspeccionada
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: MUTED }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: "#fff", border: `2px solid ${BORDER}` }} /> Pendiente
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
