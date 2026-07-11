import React, { useState, useEffect } from 'react';
import { MONO, ORANGE, NAVY, YELLOW, FIELD_DARK, BORDER_DARK, LABEL_BLUE, VALUE_COLOR } from '../theme';
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

const sanitizeDecimal = (v: string) => {
  const clean = v.replace(/[^0-9.]/g, '');
  const firstDot = clean.indexOf('.');
  if (firstDot === -1) return clean;
  return clean.slice(0, firstDot + 1) + clean.slice(firstDot + 1).replace(/\./g, '');
};

interface Props {
  data: Record<string, string>;
  commit: (next: Record<string, string>) => void | Promise<void>;
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
  presionRef: React.RefObject<HTMLInputElement | null>;
  onNewMarca: (nombre: string) => void;
  onNewModelo: (nombre: string) => void;
  onNewMedida: (nombre: string) => void;
  onNewReencauche: (nombre: string) => void;
  onAccordionChange?: (expanded: boolean) => void;
  showBuscarOtra?: boolean;
  onBuscarOtra?: () => void;
}

export default function FormBody({
  data, commit, marcas, modelos, medidas, reencauches, anomalias, valvulas, condiciones,
  r1Ref, r2Ref, r3Ref, r4Ref, presionRef,
  onNewMarca, onNewModelo, onNewMedida, onNewReencauche, onAccordionChange,
  showBuscarOtra, onBuscarOtra,
}: Props) {
  const remRefs = { r1: r1Ref, r2: r2Ref, r3: r3Ref, r4: r4Ref };
  // R4 siempre alcanzable por Enter, en cualquier eje: es un campo opcional,
  // no exclusivo de Libre/Dual (ver specs/reglas_negocio.md §1).
  const remNext: Record<string, string | null> = { r1: 'r2', r2: 'r3', r3: 'r4', r4: null };

  const advanceRem = (key: string) => {
    const nk = remNext[key];
    setTimeout(() => {
      if (nk) {
        const el = remRefs[nk as keyof typeof remRefs]?.current;
        el?.focus();
        el?.select();
      } else {
        presionRef.current?.focus();
        presionRef.current?.select();
      }
    }, 0);
  };

  const handleRemChange = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    commit({ [key]: sanitizeDecimal(e.target.value) });
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
  const condicionOptions = condiciones.flatMap(c => [`${c.codigo} · ${c.nombre}`, c.codigo]);
  const normalizeCondicion = (value: string) => {
    const clean = value.trim();
    const match = condiciones.find(c =>
      clean.toLowerCase() === c.codigo.toLowerCase() ||
      clean.toLowerCase() === c.nombre.toLowerCase() ||
      clean.toLowerCase().startsWith(`${c.codigo.toLowerCase()} `)
    );
    commit({ condicion: match ? match.codigo : clean });
  };

  const [expanded, setExpanded] = useState(false);
  const [focusedRem, setFocusedRem] = useState<string | null>(null);
  const [focusedPresion, setFocusedPresion] = useState(false);

  useEffect(() => {
    onAccordionChange?.(expanded);
  }, [expanded, onAccordionChange]);

  const toggleAccordion = () => setExpanded(prev => !prev);

  const presionDone = () => {
    setFocusedPresion(false);
  };

  const remCell = (key: string, label: string) => {
    const active = focusedRem === key;
    const hasValue = data[key] !== '';
    return (
      <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: LABEL_BLUE, letterSpacing: '0.1em', fontFamily: MONO }}>{label}</span>
        <div style={{
          height: 72,
          border: `2px solid ${active ? ORANGE : BORDER_DARK}`,
          borderRadius: 8,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: FIELD_DARK,
          transition: 'border-color 0.15s',
          overflow: 'hidden',
          width: '100%',
        }}>
          <input
            className="dark-input"
            ref={remRefs[key as keyof typeof remRefs] as React.RefObject<HTMLInputElement>}
            type="text" inputMode="numeric" value={data[key]}
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
              minWidth: 0,
            }}
          />
          <span style={{ fontSize: 10, color: LABEL_BLUE, fontWeight: 700, paddingBottom: 4, letterSpacing: '0.06em', flexShrink: 0 }}>mm</span>
        </div>
      </div>
    );
  };

  const summaryParts = [data.codigo, data.marca, data.medida].filter(Boolean);
  const summaryText = summaryParts.join(' · ') || 'Sin datos — toca para completar';

  return (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '16px 16px 8px', display: 'flex', flexDirection: 'column', gap: 18, width: '100%', boxSizing: 'border-box' }}>

      <div style={{ padding: '0 2px', width: '100%', boxSizing: 'border-box' }}>
        <button
          onClick={toggleAccordion}
          className="pressable"
          style={{
            width: '100%', background: FIELD_DARK, border: `2px solid ${expanded ? ORANGE : BORDER_DARK}`,
            borderRadius: 10, padding: '14px 16px', cursor: 'pointer', fontFamily: MONO,
            textAlign: 'left', transition: 'border-color 0.15s', boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: LABEL_BLUE, letterSpacing: '0.12em', marginBottom: 4 }}>DATOS DEL NEUMÁTICO</div>
              {!expanded && (
                <div style={{ fontSize: 15, fontWeight: 800, color: VALUE_COLOR, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' as const }}>
                  {summaryText}
                </div>
              )}
            </div>
            <svg
              width="16" height="16" viewBox="0 0 16 16" fill="none"
              style={{ flexShrink: 0, transition: 'transform 0.24s cubic-bezier(0.22,1,0.36,1)', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
            >
              <path d="M4 6l4 4 4-4" stroke={expanded ? ORANGE : LABEL_BLUE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </button>

        <div className={`accordion-body${expanded ? ' open' : ''}`}>
          <div className="accordion-inner" style={{ overflow: 'hidden' }}>
            <div style={{ paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <AutocompleteField
                label="CÓDIGO"
                value={data.codigo}
                onChange={v => commit({ codigo: v })}
                options={CODIGO_ESPECIALES}
                allowNew
                placeholder="1234"
                showAllOnFocus
                inputStyle={{ fontSize: 22, fontWeight: 800, padding: '8px 12px', letterSpacing: '0.03em', fontVariantNumeric: 'tabular-nums' }}
              />

              <AutocompleteField
                label="MARCA"
                value={data.marca}
                onChange={marca => commit({ marca, modelo: '' })}
                options={marcas.map(m => m.nombre)}
                placeholder="Buscar marca…"
                allowNew
                onNew={onNewMarca}
              />

              <AutocompleteField
                label="MODELO"
                value={data.modelo}
                onChange={modelo => commit({ modelo })}
                options={modelos.map(m => m.nombre)}
                placeholder={data.marca ? 'Buscar modelo…' : 'Primero elige una marca'}
                disabled={!data.marca}
                allowNew={!!data.marca}
                onNew={onNewModelo}
              />

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <AutocompleteField
                    label="MEDIDA"
                    value={data.medida}
                    onChange={medida => commit({ medida })}
                    options={medidas.map(m => m.nombre)}
                    placeholder="295/80 R22.5"
                    allowNew
                    onNew={onNewMedida}
                    filterMode="includes"
                    showAllOnFocus
                  />
                </div>
                <div style={{ minWidth: 0 }}>
                  <AutocompleteField
                    label="CONDICIÓN"
                    value={data.condicion}
                    onChange={normalizeCondicion}
                    options={condicionOptions}
                    placeholder="N, R1, R2…"
                    showAllOnFocus
                    filterMode="includes"
                  />
                </div>
              </div>

              {showReencauche && (
                <div style={{ paddingLeft: 14, borderLeft: `2px solid ${BORDER_DARK}`, marginLeft: 2 }}>
                  <AutocompleteField
                    label="DISEÑO DE REENCAUCHE"
                    value={data.reencauche}
                    onChange={reencauche => commit({ reencauche })}
                    options={reencauches.map(r => r.nombre)}
                    placeholder="Buscar diseño…"
                    allowNew
                    onNew={onNewReencauche}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 0' }}>
        <div style={{ flex: 1, height: 1, background: BORDER_DARK }} />
      </div>

      <div style={{ padding: '0 2px' }}>
        <span style={LABEL_PRIMARY}>REMANENTE (mm)</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          {remCell('r1', 'R1')}{remCell('r2', 'R2')}{remCell('r3', 'R3')}{remCell('r4', 'R4')}
        </div>
      </div>

      <div style={{ padding: '0 2px' }}>
        <span style={LABEL_PRIMARY}>PRESIÓN</span>
        <div style={{
          height: 68, border: `2px solid ${focusedPresion ? ORANGE : BORDER_DARK}`, borderRadius: 8,
          display: 'flex', alignItems: 'center', padding: '0 16px', background: FIELD_DARK,
          transition: 'border-color 0.15s', overflow: 'hidden',
        }}>
          <input
            className="dark-input"
            ref={presionRef as React.RefObject<HTMLInputElement>}
            type="text" inputMode="numeric" value={data.presion}
            onChange={e => commit({ presion: sanitizeDecimal(e.target.value) })}
            onFocus={e => { e.target.select(); setFocusedPresion(true); }}
            onBlur={presionDone}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
            placeholder="—"
            style={{
              flex: 1, minWidth: 0, border: 'none', outline: 'none', fontSize: 32, fontWeight: 800,
              color: data.presion ? VALUE_COLOR : BORDER_DARK, padding: 0, background: 'transparent',
              fontVariantNumeric: 'tabular-nums' as const, fontFamily: MONO,
            }}
          />
          <span style={{ fontSize: 13, color: LABEL_BLUE, fontWeight: 700, marginLeft: 8, letterSpacing: '0.04em', flexShrink: 0 }}>psi</span>
        </div>
      </div>

      <div style={{ padding: '0 2px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ ...LABEL, marginBottom: 0 }}>TAPA DE VÁLVULA</span>
          {valvulaAlert && (
            <span className="tick-in" style={{ fontSize: 9, fontWeight: 800, color: ORANGE, background: 'rgba(240,104,34,0.15)', padding: '2px 7px', borderRadius: 4, letterSpacing: '0.06em', flexShrink: 0 }}>⚠ REVISAR</span>
          )}
        </div>
        <AutocompleteField
          label=""
          value={data.tapaValvula}
          onChange={v => commit({ tapaValvula: v })}
          options={valvulas.map(v => v.nombre)}
          placeholder="Tipo de válvula…"
        />
      </div>

      <div style={{ padding: '0 2px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ ...LABEL, marginBottom: 0 }}>ANOMALÍA</span>
          {anomaliaAlert && (
            <span className="tick-in" style={{ fontSize: 9, fontWeight: 800, color: ORANGE, background: 'rgba(240,104,34,0.15)', padding: '2px 7px', borderRadius: 4, letterSpacing: '0.06em', flexShrink: 0 }}>⚠ ACTIVA</span>
          )}
        </div>
        <AutocompleteField
          label=""
          value={data.anomalia}
          onChange={v => commit({ anomalia: v })}
          options={anomalias.map(a => a.nombre)}
          placeholder="Buscar anomalía…"
          filterMode="includes"
        />
      </div>

      {showBuscarOtra && (
        <div style={{ padding: '8px 2px 16px' }}>
          <button
            onClick={onBuscarOtra}
            className="pressable chamfer"
            style={{ width: '100%', background: YELLOW, color: NAVY, border: 'none', padding: 14, fontWeight: 800, fontSize: 14, letterSpacing: '0.04em', cursor: 'pointer', fontFamily: MONO }}
          >
            TERMINAR Y BUSCAR OTRA UNIDAD →
          </button>
        </div>
      )}

      <div style={{ height: 8 }} />
    </div>
  );
}
