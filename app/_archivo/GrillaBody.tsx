import React, { useState, useRef } from 'react';
import { MONO, NAVY, ORANGE, YELLOW, INK, BORDER, FIELD_BG, MUTED } from '../theme';
import type { CatMarca, CatModelo, CatMedida, CatReencauche, CatAnomalia, CatValvula, CatCondicion } from '../db/schema';
import AutocompleteField from '../components/AutocompleteField';

const CELDAS = ['r1', 'r2', 'r3', 'r4', 'presion'] as const;
const labelStyle = { fontSize: 12, fontWeight: 800, color: '#4a5568', letterSpacing: '0.12em', display: 'block' as const, marginBottom: 6, fontFamily: MONO };
const selectBase = { width: '100%', border: '', borderRadius: 6, padding: '11px 36px 11px 12px', fontSize: 13, fontWeight: 700, color: INK, outline: 'none', background: FIELD_BG, appearance: 'none' as const, WebkitAppearance: 'none' as const, fontFamily: MONO, boxSizing: 'border-box' as const };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ width: '100%' }}><label style={labelStyle}>{label}</label>{children}</div>;
}

function SelectWrap({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative' }}>
      {children}
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
        <path d="M2 5l5 5 5-5" stroke={MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}

interface Props {
  cabeceraId: string | null;
  store: Record<number, Record<string, string>>;
  setStore: React.Dispatch<React.SetStateAction<Record<number, Record<string, string>>>>;
  flashSave: () => void;
  POS: Record<number, { etq: string }>;
  FILAS: number[];
  marcas: CatMarca[];
  modelos: CatModelo[];
  medidas: CatMedida[];
  reencauches: CatReencauche[];
  anomalias: CatAnomalia[];
  valvulas: CatValvula[];
  condiciones: CatCondicion[];
  upsertNeumatico: (input: any) => Promise<any>;
}

export default function GrillaBody({ cabeceraId, store, setStore, flashSave, POS, FILAS, marcas, modelos, medidas, reencauches, anomalias, valvulas, condiciones, upsertNeumatico }: Props) {
  const [activa, setActiva] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<number | null>(null);

  const fieldRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const empty = (): Record<string, string> => ({
    codigo: '', r1: '', r2: '', r3: '', r4: '', presion: '',
    tapaValvula: '', anomalia: '', marca: '', modelo: '', condicion: '', reencauche: '', medida: '',
  });

  const orden = FILAS.flatMap(p => CELDAS.map(f => `${p}-${f}`));

  const rec = (p: number) => store[p] || empty();

  const upd = async (p: number, f: string, v: string) => {
    const next = { ...(store[p] || empty()), [f]: v };
    setStore(s => ({ ...s, [p]: next }));
    flashSave();
    if (cabeceraId) {
      const toNum = (val: string) => val === '' ? null : Number(val);
      await upsertNeumatico({
        cabecera_id: cabeceraId, posicion: p,
        codigo: next.codigo || null, marca: next.marca || null, modelo: next.modelo || null,
        condicion: next.condicion || null, reencauche: next.reencauche || null,
        medida: next.medida || null, r1: toNum(next.r1), r2: toNum(next.r2),
        r3: toNum(next.r3), r4: toNum(next.r4), presion: toNum(next.presion),
        tapa_valvula: next.tapaValvula || null, anomalia: next.anomalia || null,
      });
    }
  };

  const setField = (p: number, f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => upd(p, f, e.target.value);

  const onEnter = (p: number, f: string) => (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const i = orden.indexOf(`${p}-${f}`);
    if (i >= 0 && i < orden.length - 1) fieldRefs.current[orden[i + 1]]?.focus();
  };

  const completa = (p: number) => { const d = rec(p); return !!(d.r1 && d.r2 && d.r3 && d.r4 && d.presion); };
  const empezada = (p: number) => { const d = rec(p); return !!(d.r1 || d.r2 || d.r3 || d.r4 || d.presion); };

  const openDetalle = (p: number) => setDetalle(p);

  const barColor = (p: number) => p === activa ? ORANGE : completa(p) ? NAVY : empezada(p) ? YELLOW : BORDER;

  const Cell = (p: number, f: string) => {
    const d = rec(p);
    const filled = d[f] !== '';
    const esPsi = f === 'presion';
    return (
      <input ref={el => { fieldRefs.current[`${p}-${f}`] = el; }} type="number" inputMode="numeric" value={d[f]} onChange={setField(p, f)}
        onFocus={e => { e.target.select(); setActiva(p); }} onKeyDown={onEnter(p, f)} placeholder="·"
        style={{ width: '100%', height: 46, border: 'none', outline: 'none', textAlign: 'center', fontSize: 18, fontWeight: 800, color: filled ? INK : '#cfd6e2', background: p === activa ? '#fff' : (esPsi ? '#fbfcfe' : 'transparent'), fontFamily: MONO, fontVariantNumeric: 'tabular-nums' as const, boxSizing: 'border-box' as const, borderLeft: esPsi ? `1px solid ${BORDER}` : 'none' }} />
    );
  };

  const dd = detalle != null ? (store[detalle] || empty()) : empty();
  const showReencaucheDet = dd.condicion !== '' && dd.condicion !== 'N';

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '92px 1fr 1fr 1fr 1fr 1fr', alignItems: 'center', background: '#e6eaf1', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: MUTED, letterSpacing: '0.1em', padding: '8px 0 8px 14px' }}>LLANTA</div>
        {['R1', 'R2', 'R3', 'R4'].map(h => <div key={h} style={{ fontSize: 11, fontWeight: 800, color: MUTED, textAlign: 'center', padding: '8px 0' }}>{h}</div>)}
        <div style={{ fontSize: 11, fontWeight: 800, color: NAVY, textAlign: 'center', padding: '8px 0', borderLeft: `1px solid ${BORDER}` }}>PSI</div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', background: '#fff' }}>
        {FILAS.map(p => {
          const d = store[p] || empty();
          const anomalia = !!d.anomalia;
          const valvulaMal = d.tapaValvula !== '' && d.tapaValvula !== 'OK';
          return (
            <div key={p} style={{ display: 'grid', gridTemplateColumns: '92px 1fr 1fr 1fr 1fr 1fr', alignItems: 'stretch', borderBottom: '1px solid #eef1f6', background: p === activa ? '#fff8f4' : '#fff', position: 'relative' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: barColor(p) }} />
              <button onClick={() => openDetalle(p)} style={{ background: 'none', border: 'none', borderRight: '1px solid #eef1f6', padding: '6px 6px 6px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center', cursor: 'pointer', fontFamily: MONO, textAlign: 'left', minHeight: 52, gap: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 16, fontWeight: 900, color: NAVY, lineHeight: 1 }}>{p}</span>
                  {anomalia && <span title="Anomalía" style={{ width: 7, height: 7, borderRadius: '50%', background: ORANGE }} />}
                  {valvulaMal && <span title="Válvula" style={{ width: 7, height: 7, borderRadius: '50%', background: YELLOW }} />}
                </div>
                <span style={{ fontSize: 9, fontWeight: 700, color: MUTED, lineHeight: 1.1 }}>{POS[p]?.etq}</span>
                <span style={{ fontSize: 8.5, color: d.codigo ? '#9aa4b6' : '#cfd6e2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 76 }}>{d.codigo || 'sin código'}</span>
              </button>
              {Cell(p, 'r1')}{Cell(p, 'r2')}{Cell(p, 'r3')}{Cell(p, 'r4')}{Cell(p, 'presion')}
            </div>
          );
        })}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', padding: '12px 14px 4px', justifyContent: 'center' }}>
          {[['Lista', NAVY], ['A medias', YELLOW], ['Pendiente', BORDER]].map(([t, c]) => (
            <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: MUTED }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: c }} /> {t}
            </span>
          ))}
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: MUTED }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: ORANGE }} /> Anomalía
          </span>
        </div>
      </div>

      {/* ── Sheet: Detalle ── */}
      {detalle != null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,16,30,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 50 }} onClick={() => setDetalle(null)}>
          <div style={{ background: '#fff', borderRadius: '12px 12px 0 0', width: '100%', padding: '18px 18px 26px', maxHeight: '92%', overflowY: 'auto', boxSizing: 'border-box' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: BORDER, margin: '0 auto 16px' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ background: NAVY, color: '#fff', fontWeight: 900, fontSize: 18, width: 38, height: 38, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{detalle}</span>
              <div>
                <div style={{ fontWeight: 900, fontSize: 15, color: NAVY }}>Llanta {detalle}</div>
                <div style={{ fontSize: 12, color: MUTED }}>{POS[detalle]?.etq}</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="CÓDIGO DE NEUMÁTICO">
                <div style={{ border: `2px solid ${dd.codigo ? NAVY : BORDER}`, borderRadius: 10, display: 'flex', alignItems: 'center', padding: '0 12px', background: FIELD_BG }}>
                  <input value={dd.codigo} onChange={setField(detalle, 'codigo')} onFocus={e => e.target.select()} placeholder="Escanear o ingresar código"
                    style={{ flex: 1, border: 'none', outline: 'none', fontSize: 18, fontWeight: 800, color: INK, padding: '12px 0', background: 'transparent', fontFamily: MONO, letterSpacing: '0.02em' }} />
                </div>
              </Field>
              <AutocompleteField
                label="MARCA"
                value={dd.marca}
                onChange={marca => { upd(detalle, 'marca', marca); upd(detalle, 'modelo', ''); }}
                options={marcas.map(m => m.nombre)}
                placeholder="Buscar marca…"
              />
              <AutocompleteField
                label="MODELO"
                value={dd.modelo}
                onChange={modelo => upd(detalle, 'modelo', modelo)}
                options={modelos.map(m => m.nombre)}
                placeholder={dd.marca ? 'Buscar modelo…' : 'Primero elige marca'}
                disabled={!dd.marca}
              />
              <Field label="CONDICIÓN">
                <SelectWrap>
                  <select value={dd.condicion} onChange={setField(detalle, 'condicion')} style={{ ...selectBase, border: `2px solid ${dd.condicion ? NAVY : BORDER}` }}>
                    <option value="">Seleccionar…</option>
                    {condiciones.map(c => <option key={c.codigo} value={c.codigo}>{c.nombre}</option>)}
                  </select>
                </SelectWrap>
              </Field>
              {showReencaucheDet && (
                <Field label="DISEÑO DE REENCAUCHE">
                  <SelectWrap>
                    <select value={dd.reencauche} onChange={setField(detalle, 'reencauche')} style={{ ...selectBase, border: `2px solid ${dd.reencauche ? NAVY : BORDER}` }}>
                      <option value="">Seleccionar diseño…</option>
                      {reencauches.map(r => <option key={r.id} value={r.nombre}>{r.nombre}</option>)}
                    </select>
                  </SelectWrap>
                </Field>
              )}
              <Field label="MEDIDA">
                <SelectWrap>
                  <select value={dd.medida} onChange={setField(detalle, 'medida')} style={{ ...selectBase, border: `2px solid ${dd.medida ? NAVY : BORDER}` }}>
                    <option value="">Seleccionar medida…</option>
                    {medidas.map(m => <option key={m.id} value={m.nombre}>{m.nombre}</option>)}
                  </select>
                </SelectWrap>
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <AutocompleteField
                  label="VÁLVULA"
                  value={dd.tapaValvula}
                  onChange={v => upd(detalle, 'tapaValvula', v)}
                  options={valvulas.map(v => v.nombre)}
                  placeholder="Buscar…"
                />
                <AutocompleteField
                  label="ANOMALÍA"
                  value={dd.anomalia}
                  onChange={v => upd(detalle, 'anomalia', v)}
                  options={anomalias.map(a => a.nombre)}
                  placeholder="Buscar…"
                />
              </div>
            </div>
            <button onClick={() => setDetalle(null)} style={{ width: '100%', background: NAVY, color: '#fff', border: 'none', borderRadius: 12, padding: 14, fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: MONO, marginTop: 20, minHeight: 52 }}>Listo</button>
          </div>
        </div>
      )}
    </>
  );
}
