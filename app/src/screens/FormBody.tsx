import React, { useState } from 'react';
import { MONO, ORANGE, FIELD_DARK, BORDER_DARK, LABEL_BLUE, VALUE_COLOR } from '../theme';
import type { CatMarca, CatModelo, CatMedida, CatReencauche, CatAnomalia, CatValvula, CatCondicion } from '../db/schema';
import AutocompleteField from '../components/AutocompleteField';

const LABEL_PRIMARY: React.CSSProperties = {
  fontSize: 12, fontWeight: 800, color: LABEL_BLUE, letterSpacing: '0.1em',
  display: 'block', marginBottom: 10, fontFamily: MONO,
};
const LABEL: React.CSSProperties = {
  fontSize: 11, fontWeight: 800, color: LABEL_BLUE, letterSpacing: '0.1em',
  display: 'block', marginBottom: 8, fontFamily: MONO,
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

  const [focusedRem, setFocusedRem] = useState<string | null>(null);

  const remCell = (key: string, label: string) => {
    const active = focusedRem === key;
    const hasValue = data[key] !== '';
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: LABEL_BLUE, letterSpacing: '0.1em', fontFamily: MONO }}>{label}</span>
        <div style={{
          height: 72,
          border: `2px solid ${active ? ORANGE : BORDER_DARK}`,
          borderRadius: 8,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: FIELD_DARK,
          transition: 'border-color 0.15s',
        }}>
          <input
            className="dark-input"
            ref={remRefs[key as keyof typeof remRefs] as React.RefObject<HTMLInputElement>}
            type="number" inputMode="numeric" value={data[key]}
            onChange={handleRemChange(key)}
            onFocus={e => { e.target.select(); setFocusedRem(key); }}
            onBlur={() => setFocusedRem(null)}
            onKeyDown={handleRemKey(key)}
            placeholder="—"
            style={{
              width: '100%', border: 'none', outline: 'none', textAlign: 'center',
              fontSize: 24, fontWeight: 800,
              color: hasValue ? VALUE_COLOR : BORDER_DARK,
              padding: '4px 4px 0',
              background: 'transparent', fontVariantNumeric: 'tabular-nums' as const, fontFamily: MONO,
            }}
          />
          <span style={{ fontSize: 10, color: LABEL_BLUE, fontWeight: 700, paddingBottom: 4, letterSpacing: '0.06em' }}>mm</span>
        </div>
      </div>
    );
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'clip', padding: '16px 16px 8px', display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* ── CÓDIGO DE NEUMÁTICO ── */}
      <div style={{ padding: '0 2px' }}>
        <span style={LABEL_PRIMARY}>CÓDIGO DE NEUMÁTICO</span>
        <AutocompleteField
          label=""
          value={data.codigo}
          onChange={v => commit({ ...data, codigo: v })}
          options={CODIGO_ESPECIALES}
          allowNew
          placeholder="1234"
          showAllOnFocus
          inputStyle={{ fontSize: 22, fontWeight: 800, padding: '8px 12px', letterSpacing: '0.03em' }}
        />
      </div>

      {/* ── DATOS DEL NEUMÁTICO ── */}
      <div style={{ padding: '0 2px' }}>
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

      <div style={{ padding: '0 2px' }}>
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

      {/* ── MEDIDA + CONDICIÓN en una fila ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '0 2px' }}>
        <div style={{ minWidth: 0 }}>
          <AutocompleteField
            label="MEDIDA"
            value={data.medida}
            onChange={medida => commit({ ...data, medida })}
            options={medidas.map(m => m.nombre)}
            placeholder="295/80 R22.5"
            allowNew
            onNew={onNewMedida}
            filterMode="includes"
          />
        </div>
        <div style={{ minWidth: 0 }}>
          <AutocompleteField
            label="CONDICIÓN"
            value={data.condicion}
            onChange={condicion => commit({ ...data, condicion })}
            options={condiciones.map(c => c.codigo)}
            placeholder="—"
            showAllOnFocus
            filterMode="startsWith"
          />
        </div>
      </div>

      {/* ── DISEÑO DE REENCAUCHE — sub-campo de Condición ── */}
      {showReencauche && (
        <div style={{ padding: '0 2px', paddingLeft: 14, borderLeft: `2px solid ${BORDER_DARK}`, marginLeft: 2 }}>
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

      {/* ── Separador ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 0' }}>
        <div style={{ flex: 1, height: 1, background: BORDER_DARK }} />
      </div>

      {/* ── REMANENTE ── */}
      <div style={{ padding: '0 2px' }}>
        <span style={LABEL_PRIMARY}>REMANENTE (mm)</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {remCell('r1', 'R1')}{remCell('r2', 'R2')}{remCell('r3', 'R3')}{remCell('r4', 'R4')}
        </div>
      </div>

      {/* ── PRESIÓN ── */}
      <div style={{ padding: '0 2px' }}>
        <span style={LABEL_PRIMARY}>PRESIÓN</span>
        <div style={{
          height: 68, border: `2px solid ${BORDER_DARK}`, borderRadius: 8,
          display: 'flex', alignItems: 'center', padding: '0 16px', background: FIELD_DARK,
        }}>
          <input
            className="dark-input"
            type="number" inputMode="numeric" value={data.presion}
            onChange={set('presion')} onFocus={e => e.target.select()} placeholder="—"
            style={{
              flex: 1, border: 'none', outline: 'none', fontSize: 32, fontWeight: 800,
              color: data.presion ? VALUE_COLOR : BORDER_DARK, padding: 0, background: 'transparent',
              fontVariantNumeric: 'tabular-nums' as const, fontFamily: MONO,
            }}
          />
          <span style={{ fontSize: 13, color: LABEL_BLUE, fontWeight: 700, marginLeft: 8, letterSpacing: '0.04em' }}>psi</span>
        </div>
      </div>

      {/* ── VÁLVULA ── */}
      <div style={{ padding: '0 2px' }}>
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
      <div style={{ padding: '0 2px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={LABEL}>ANOMALÍA</span>
          {anomaliaAlert && (
            <span style={{ fontSize: 9, fontWeight: 800, color: ORANGE, background: 'rgba(240,104,34,0.15)', padding: '2px 7px', borderRadius: 4, letterSpacing: '0.06em' }}>⚠ ACTIVA</span>
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

      <div style={{ height: 8 }} />
    </div>
  );
}
