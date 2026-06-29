import React from 'react';
import { MONO, NAVY, ORANGE, INK, BORDER, FIELD_BG, MUTED } from '../theme';
import type { CatMarca, CatModelo, CatMedida, CatReencauche, CatAnomalia, CatValvula, CatCondicion } from '../db/schema';
import AutocompleteField from '../components/AutocompleteField';

// Bloques clave (Código, Remanente, Presión): título prominente
const LABEL_PRIMARY: React.CSSProperties = {
  fontSize: 13, fontWeight: 800, color: NAVY, letterSpacing: '0.06em',
  display: 'block', marginBottom: 12, fontFamily: MONO,
};
// Campos secundarios (Marca, Modelo, etc.): label más pequeño
const LABEL: React.CSSProperties = {
  fontSize: 11, fontWeight: 800, color: NAVY, letterSpacing: '0.1em',
  display: 'block', marginBottom: 10, fontFamily: MONO,
};

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 8, padding: '16px 18px',
};

const VALVULA_OK = new Set(['plástica', 'plastica', 'metalica', 'metálica']);
const CODIGO_ESPECIALES = ['No visible', 'Sin código'];

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
  r1Ref, r2Ref, r3Ref, r4Ref,
  onNewMarca, onNewModelo, onNewMedida, onNewReencauche,
}: Props) {
  const remRefs = { r1: r1Ref, r2: r2Ref, r3: r3Ref, r4: r4Ref };
  const remNext: Record<string, string | null> = { r1: 'r2', r2: 'r3', r3: 'r4', r4: null };

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    commit({ ...data, [field]: e.target.value });

  const advanceRem = (key: string) => {
    const nk = remNext[key];
    setTimeout(() => {
      if (nk) {
        const el = remRefs[nk as keyof typeof remRefs]?.current;
        el?.focus();
        el?.select();
      } else {
        remRefs[key as keyof typeof remRefs]?.current?.blur();
      }
    }, 0);
  };

  const handleRemChange = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    commit({ ...data, [key]: val });
    if (val.length >= 2) advanceRem(key);
  };

  const handleRemKey = (key: string) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      advanceRem(key);
    }
  };

  const showReencauche = data.condicion !== '' && data.condicion !== 'N';
  const anomaliaAlert = data.anomalia !== '';
  const valvulaAlert = data.tapaValvula !== '' && !VALVULA_OK.has(data.tapaValvula.toLowerCase());

  const remCell = (key: string, label: string) => {
    const filled = data[key] !== '';
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: MUTED, letterSpacing: '0.1em', fontFamily: MONO }}>{label}</span>
        <div style={{
          height: 72,
          border: `2px solid ${filled ? NAVY : BORDER}`,
          borderRadius: 8,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: '#fff',
        }}>
          <input
            ref={remRefs[key as keyof typeof remRefs] as React.RefObject<HTMLInputElement>}
            type="number" inputMode="numeric" value={data[key]}
            onChange={handleRemChange(key)} onFocus={e => e.target.select()} onKeyDown={handleRemKey(key)}
            placeholder="—"
            style={{
              width: '100%', border: 'none', outline: 'none', textAlign: 'center',
              fontSize: 24, fontWeight: 800, color: INK, padding: '4px 4px 0',
              background: 'transparent', fontVariantNumeric: 'tabular-nums' as const, fontFamily: MONO,
            }}
          />
          <span style={{ fontSize: 10, color: MUTED, fontWeight: 700, paddingBottom: 4, letterSpacing: '0.06em' }}>mm</span>
        </div>
      </div>
    );
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'clip', padding: '16px 16px 8px', display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── CÓDIGO DE NEUMÁTICO — flota sobre el fondo del screen ── */}
      <div style={{ padding: '0 2px' }}>
        <span style={LABEL_PRIMARY}>CÓDIGO DE NEUMÁTICO</span>
        <AutocompleteField
          label=""
          value={data.codigo}
          onChange={v => commit({ ...data, codigo: v })}
          options={CODIGO_ESPECIALES}
          allowNew
          placeholder="Escanear o escribir código"
          showAllOnFocus
          inputStyle={{ fontSize: 22, fontWeight: 800, padding: '8px 12px', letterSpacing: '0.03em' }}
        />
      </div>

      {/* ── REMANENTE — flota sobre el fondo del screen ── */}
      <div style={{ padding: '0 2px' }}>
        <span style={LABEL_PRIMARY}>REMANENTE (mm)</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {remCell('r1', 'R1')}{remCell('r2', 'R2')}{remCell('r3', 'R3')}{remCell('r4', 'R4')}
        </div>
      </div>

      {/* ── PRESIÓN — flota sobre el fondo del screen ── */}
      <div style={{ padding: '0 2px' }}>
        <span style={LABEL_PRIMARY}>PRESIÓN</span>
        <div style={{
          height: 68, border: `2px solid ${data.presion ? NAVY : BORDER}`, borderRadius: 8,
          display: 'flex', alignItems: 'center', padding: '0 16px', background: '#fff',
        }}>
          <input
            type="number" inputMode="numeric" value={data.presion}
            onChange={set('presion')} onFocus={e => e.target.select()} placeholder="—"
            style={{
              flex: 1, border: 'none', outline: 'none', fontSize: 32, fontWeight: 800,
              color: INK, padding: 0, background: 'transparent',
              fontVariantNumeric: 'tabular-nums' as const, fontFamily: MONO,
            }}
          />
          <span style={{ fontSize: 13, color: MUTED, fontWeight: 700, marginLeft: 8, letterSpacing: '0.04em' }}>psi</span>
        </div>
      </div>

      {/* ── VÁLVULA ── */}
      <div style={card}>
        <AutocompleteField
          label="VÁLVULA"
          value={data.tapaValvula}
          onChange={v => commit({ ...data, tapaValvula: v })}
          options={valvulas.map(v => v.nombre)}
          placeholder="Tipo de válvula…"
        />
        {valvulaAlert && (
          <div style={{ fontSize: 10, fontWeight: 800, color: ORANGE, marginTop: 8, letterSpacing: '0.08em' }}>⚠ REVISAR</div>
        )}
      </div>

      {/* ── ANOMALÍA ── */}
      <div style={{
        ...card,
        border: anomaliaAlert ? `2px solid ${ORANGE}` : '2px solid transparent',
        background: anomaliaAlert ? '#fff9f6' : '#fff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={LABEL}>ANOMALÍA</span>
          {anomaliaAlert && (
            <span style={{ fontSize: 9, fontWeight: 800, color: ORANGE, background: '#fdece4', padding: '2px 7px', borderRadius: 4, letterSpacing: '0.06em' }}>⚠ ACTIVA</span>
          )}
        </div>
        <AutocompleteField
          label=""
          value={data.anomalia}
          onChange={v => commit({ ...data, anomalia: v })}
          options={anomalias.map(a => a.nombre)}
          placeholder="Buscar anomalía…"
          filterMode="includes"
        />
      </div>

      {/* ── Separador datos del neumático ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
        <div style={{ flex: 1, height: 1, background: BORDER }} />
        <span style={{ fontSize: 9, fontWeight: 800, color: MUTED, letterSpacing: '0.16em' }}>DATOS DEL NEUMÁTICO</span>
        <div style={{ flex: 1, height: 1, background: BORDER }} />
      </div>

      {/* ── MARCA ── */}
      <div style={card}>
        <AutocompleteField
          label="MARCA"
          value={data.marca}
          onChange={marca => commit({ ...data, marca, modelo: '' })}
          options={marcas.map(m => m.nombre)}
          placeholder="Buscar marca…"
          allowNew
          onNew={onNewMarca}
        />
      </div>

      {/* ── MODELO ── */}
      <div style={card}>
        <AutocompleteField
          label="MODELO"
          value={data.modelo}
          onChange={modelo => commit({ ...data, modelo })}
          options={modelos.map(m => m.nombre)}
          placeholder={data.marca ? 'Buscar modelo…' : 'Primero elige una marca'}
          disabled={!data.marca}
          allowNew={!!data.marca}
          onNew={onNewModelo}
        />
      </div>

      {/* ── CONDICIÓN ── */}
      <div style={card}>
        <span style={LABEL}>CONDICIÓN</span>
        <div style={{ position: 'relative' }}>
          <select
            value={data.condicion}
            onChange={set('condicion')}
            style={{
              width: '100%', border: `2px solid ${BORDER}`, borderRadius: 6,
              padding: '11px 36px 11px 12px', fontSize: 14, fontWeight: 700, color: INK, outline: 'none',
              background: FIELD_BG, appearance: 'none' as const, WebkitAppearance: 'none' as const,
              fontFamily: MONO, boxSizing: 'border-box' as const,
            }}
          >
            <option value="" disabled>Seleccionar…</option>
            {condiciones.map(c => (
              <option key={c.codigo} value={c.codigo}>{c.nombre}</option>
            ))}
          </select>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <path d="M2 5l5 5 5-5" stroke={MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      {/* ── DISEÑO DE REENCAUCHE (condicional) ── */}
      {showReencauche && (
        <div style={card}>
          <AutocompleteField
            label="DISEÑO DE REENCAUCHE"
            value={data.reencauche}
            onChange={reencauche => commit({ ...data, reencauche })}
            options={reencauches.map(r => r.nombre)}
            placeholder="Buscar diseño…"
            allowNew
            onNew={onNewReencauche}
          />
        </div>
      )}

      {/* ── MEDIDA ── */}
      <div style={card}>
        <AutocompleteField
          label="MEDIDA"
          value={data.medida}
          onChange={medida => commit({ ...data, medida })}
          options={medidas.map(m => m.nombre)}
          placeholder="Ej: 295/80 R22.5"
          allowNew
          onNew={onNewMedida}
          filterMode="includes"
        />
      </div>

      <div style={{ height: 8 }} />
    </div>
  );
}
