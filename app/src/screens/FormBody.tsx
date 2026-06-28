import React from 'react';
import { MONO, NAVY, ORANGE, INK, BORDER, FIELD_BG, MUTED } from '../theme';
import type { CatMarca, CatModelo, CatMedida, CatReencauche, CatAnomalia, CatValvula, CatCondicion } from '../db/schema';
import AutocompleteField from '../components/AutocompleteField';

const labelStyle = { fontSize: 11, fontWeight: 800, color: MUTED, letterSpacing: '0.12em', display: 'block' as const, marginBottom: 6, fontFamily: MONO };
const selectBase = { width: '100%', border: '', borderRadius: 10, padding: '11px 12px', fontSize: 13, fontWeight: 700, color: INK, outline: 'none', background: FIELD_BG, appearance: 'auto' as const, fontFamily: MONO, boxSizing: 'border-box' as const };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ width: '100%' }}><label style={labelStyle}>{label}</label>{children}</div>;
}

// Válvulas que no requieren revisión (estado normal)
const VALVULA_OK = new Set(['plástica', 'plastica', 'metalica', 'metálica']);

interface Props {
  data: Record<string, string>;
  commit: (next: Record<string, string>) => void;
  marcas: CatMarca[];
  modelos: CatModelo[];
  medidas: CatMedida[];
  reencauches: CatReencauche[];
  anomalias: CatAnomalia[];
  valvulas: CatValvula[];
  condiciones: CatCondicion[];
  showSheet: boolean;
  setShowSheet: (v: boolean) => void;
  codigoEditing: boolean;
  setCodigoEditing: (v: boolean) => void;
  codigoRef: React.RefObject<HTMLInputElement | null>;
  r1Ref: React.RefObject<HTMLInputElement | null>;
  r2Ref: React.RefObject<HTMLInputElement | null>;
  r3Ref: React.RefObject<HTMLInputElement | null>;
  r4Ref: React.RefObject<HTMLInputElement | null>;
  onNewMarca: (nombre: string) => void;
  onNewModelo: (nombre: string) => void;
  onNewMedida: (nombre: string) => void;
  onNewReencauche: (nombre: string) => void;
}

export default function FormBody({
  data, commit, marcas, modelos, medidas, reencauches, anomalias, valvulas, condiciones,
  showSheet, setShowSheet, codigoEditing, setCodigoEditing, codigoRef,
  r1Ref, r2Ref, r3Ref, r4Ref,
  onNewMarca, onNewModelo, onNewMedida, onNewReencauche,
}: Props) {
  const remRefs: Record<string, React.RefObject<HTMLInputElement | null>> = { r1: r1Ref, r2: r2Ref, r3: r3Ref, r4: r4Ref };
  const remNext: Record<string, string | null> = { r1: 'r2', r2: 'r3', r3: 'r4', r4: null };

  const setField = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => commit({ ...data, [field]: e.target.value });

  const handleRemKey = (key: string) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nk = remNext[key];
      if (nk) remRefs[nk]?.current?.focus();
      else remRefs[key]?.current?.blur();
    }
  };

  const showReencauche = data.condicion !== '' && data.condicion !== 'N';
  const datosResumen = [data.marca, data.modelo, data.condicion, data.reencauche, data.medida].filter(Boolean).join(' · ') || 'Marca, modelo, medida…';
  const anomaliaAlert = data.anomalia !== '';
  const valvulaAlert = data.tapaValvula !== '' && !VALVULA_OK.has(data.tapaValvula.toLowerCase());

  // Opciones especiales de código (sin datos de neumático)
  const CODIGO_ESPECIALES = ['No visible', 'Sin código'];

  const remCell = (key: string, label: string) => {
    const filled = data[key] !== '';
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: MUTED, letterSpacing: '0.08em' }}>{label}</span>
        <div style={{ height: 68, border: `2px solid ${filled ? NAVY : BORDER}`, borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
          <input ref={remRefs[key] as React.RefObject<HTMLInputElement>} type="number" inputMode="numeric" value={data[key]} onChange={setField(key)} onFocus={e => e.target.select()} onKeyDown={handleRemKey(key)} placeholder="—"
            style={{ width: '100%', border: 'none', outline: 'none', textAlign: 'center', fontSize: 22, fontWeight: 800, color: INK, padding: '4px 4px 0', background: 'transparent', fontVariantNumeric: 'tabular-nums' as const, fontFamily: MONO }} />
          <span style={{ fontSize: 10, color: MUTED, fontWeight: 700, paddingBottom: 4 }}>mm</span>
        </div>
      </div>
    );
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* ── Código de neumático ── */}
      <div style={{ background: '#fff', borderRadius: 14, padding: 14 }}>
        <Field label="CÓDIGO DE NEUMÁTICO">
          {data.codigo && !codigoEditing ? (
            <button onClick={() => { setCodigoEditing(true); setTimeout(() => codigoRef.current?.focus(), 10); }}
              style={{ width: '100%', background: NAVY, border: 'none', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontFamily: MONO, minHeight: 56, boxSizing: 'border-box' }}>
              <span style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '0.04em', fontVariantNumeric: 'tabular-nums' as const, lineHeight: 1.1 }}>{data.codigo}</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: '0.08em' }}>EDITAR</span>
            </button>
          ) : (
            <AutocompleteField
              label=""
              value={data.codigo}
              onChange={v => { commit({ ...data, codigo: v }); if (v) setCodigoEditing(false); }}
              options={CODIGO_ESPECIALES}
              allowNew
              placeholder="Escanear o ingresar código"
            />
          )}
        </Field>
      </div>

      {/* ── Resumen datos del neumático ── */}
      <button onClick={() => setShowSheet(true)}
        style={{ background: '#fff', border: `2px solid ${data.marca ? NAVY : BORDER}`, borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', width: '100%', textAlign: 'left', fontFamily: MONO, gap: 10, minHeight: 60 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: NAVY }}>Datos del neumático</div>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{datosResumen}</div>
        </div>
        <span style={{ color: ORANGE, fontSize: 20, fontWeight: 800, flexShrink: 0 }}>›</span>
      </button>

      {/* ── Remanente ── */}
      <div style={{ background: '#fff', borderRadius: 14, padding: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: MUTED, letterSpacing: '0.12em', marginBottom: 10 }}>REMANENTE (mm)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {remCell('r1', 'R1')}{remCell('r2', 'R2')}{remCell('r3', 'R3')}{remCell('r4', 'R4')}
        </div>
      </div>

      {/* ── Presión (más ancha) + Válvula ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 10, alignItems: 'start' }}>
        <div style={{ background: '#fff', borderRadius: 14, padding: 14 }}>
          <Field label="PRESIÓN">
            <div style={{ height: 52, border: `2px solid ${data.presion ? NAVY : BORDER}`, borderRadius: 10, display: 'flex', alignItems: 'center', padding: '0 12px', background: FIELD_BG, boxSizing: 'border-box' as const }}>
              <input type="number" inputMode="numeric" value={data.presion} onChange={setField('presion')} onFocus={e => e.target.select()} placeholder="—"
                style={{ flex: 1, minWidth: 0, width: '100%', border: 'none', outline: 'none', fontSize: 24, fontWeight: 800, color: INK, padding: 0, background: 'transparent', fontVariantNumeric: 'tabular-nums' as const, fontFamily: MONO }} />
              <span style={{ fontSize: 11, color: MUTED, fontWeight: 700, marginLeft: 6, flexShrink: 0 }}>psi</span>
            </div>
          </Field>
        </div>
        <div style={{ background: '#fff', borderRadius: 14, padding: 14 }}>
          <AutocompleteField
            label="VÁLVULA"
            value={data.tapaValvula}
            onChange={v => commit({ ...data, tapaValvula: v })}
            options={valvulas.map(v => v.nombre)}
            placeholder="Tipo…"
          />
          {valvulaAlert && <div style={{ fontSize: 9, fontWeight: 800, color: ORANGE, marginTop: 4, letterSpacing: '0.06em' }}>⚠ REVISAR</div>}
        </div>
      </div>

      {/* ── Anomalía ── */}
      <div style={{ background: anomaliaAlert ? '#fff9f6' : '#fff', borderRadius: 14, padding: 14, border: anomaliaAlert ? `2px solid ${ORANGE}` : '2px solid transparent' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: MUTED, letterSpacing: '0.12em' }}>ANOMALÍA</span>
          {anomaliaAlert && <span style={{ fontSize: 9, fontWeight: 800, color: ORANGE, background: '#fdece4', padding: '2px 7px', borderRadius: 4, letterSpacing: '0.06em' }}>⚠ ACTIVA</span>}
        </div>
        <AutocompleteField
          label=""
          value={data.anomalia}
          onChange={v => commit({ ...data, anomalia: v })}
          options={anomalias.map(a => a.nombre)}
          placeholder="Buscar anomalía…"
        />
      </div>

      {/* ── Sheet: Datos del neumático ── */}
      {showSheet && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,16,30,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 50 }} onClick={() => setShowSheet(false)}>
          <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', padding: '18px 18px 26px', maxHeight: '90%', overflowY: 'auto', boxSizing: 'border-box' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: BORDER, margin: '0 auto 18px' }} />
            <div style={{ fontWeight: 900, fontSize: 16, color: NAVY, marginBottom: 18 }}>Datos del neumático</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              <AutocompleteField
                label="MARCA DE NEUMÁTICO"
                value={data.marca}
                onChange={marca => commit({ ...data, marca, modelo: '' })}
                options={marcas.map(m => m.nombre)}
                placeholder="Buscar marca…"
                allowNew
                onNew={onNewMarca}
              />

              <AutocompleteField
                label="MODELO DE NEUMÁTICO"
                value={data.modelo}
                onChange={modelo => commit({ ...data, modelo })}
                options={modelos.map(m => m.nombre)}
                placeholder={data.marca ? 'Buscar modelo…' : 'Primero elige una marca'}
                disabled={!data.marca}
                allowNew={!!data.marca}
                onNew={onNewModelo}
              />

              <Field label="CONDICIÓN">
                <select value={data.condicion} onChange={setField('condicion')} style={{ ...selectBase, border: `2px solid ${data.condicion ? NAVY : BORDER}` }}>
                  <option value="">—</option>
                  {condiciones.map(c => <option key={c.codigo} value={c.codigo}>{c.codigo}</option>)}
                </select>
              </Field>

              {showReencauche && (
                <AutocompleteField
                  label="DISEÑO DE REENCAUCHE"
                  value={data.reencauche}
                  onChange={reencauche => commit({ ...data, reencauche })}
                  options={reencauches.map(r => r.nombre)}
                  placeholder="Buscar diseño…"
                  allowNew
                  onNew={onNewReencauche}
                />
              )}

              <AutocompleteField
                label="MEDIDA"
                value={data.medida}
                onChange={medida => commit({ ...data, medida })}
                options={medidas.map(m => m.nombre)}
                placeholder="Buscar medida…"
                allowNew
                onNew={onNewMedida}
              />

            </div>
            <button onClick={() => setShowSheet(false)}
              style={{ width: '100%', background: NAVY, color: '#fff', border: 'none', borderRadius: 12, padding: 14, fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: MONO, marginTop: 20, minHeight: 52 }}>
              Listo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
