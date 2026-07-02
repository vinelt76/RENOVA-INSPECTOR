import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { inspeccionRepo } from '../db/repos/inspeccionRepo';
import { catalogoRepo } from '../db/repos/catalogoRepo';
import { unidadRepo } from '../db/repos/unidadRepo';
import { MONO, NAVY, ORANGE, YELLOW, GREEN, SCREEN_DARK, FIELD_DARK, BORDER_DARK, LABEL_BLUE, VALUE_COLOR } from '../theme';
import type { CatMarca, CatModelo, CatMedida, CatReencauche, CatAnomalia, CatValvula, CatConfiguracion, CatCondicion } from '../db/schema';
import FormBody from './FormBody';

const empty = (): Record<string, string> => ({
  codigo: '', r1: '', r2: '', r3: '', r4: '',
  presion: '', tapaValvula: '', anomalia: '',
  marca: '', modelo: '', condicion: '', reencauche: '', medida: '',
});

export default function InspeccionScreen() {
  const { cabeceraId } = useParams<{ cabeceraId: string }>();
  const { empresa, unidadNumero, unidadConfig, unidadTipoVehiculo, cabeceraId: ctxCabId } = useApp();
  const navigate = useNavigate();
  const activeCabId = cabeceraId ?? ctxCabId;

  const [pos, setPos] = useState(1);
  const [data, setData] = useState<Record<string, string>>(empty());
  const [store, setStore] = useState<Record<number, Record<string, string>>>({});
  const [flash, setFlash] = useState(false);
  const [slideDir, setSlideDir] = useState<'up' | 'down' | null>(null);
  const [showSheet, setShowSheet] = useState(false);

  const [marcas, setMarcas] = useState<CatMarca[]>([]);
  const [modelos, setModelos] = useState<CatModelo[]>([]);
  const [medidas, setMedidas] = useState<CatMedida[]>([]);
  const [reencauches, setReencauches] = useState<CatReencauche[]>([]);
  const [anomalias, setAnomalias] = useState<CatAnomalia[]>([]);
  const [valvulas, setValvulas] = useState<CatValvula[]>([]);
  const [condiciones, setCondiciones] = useState<CatCondicion[]>([]);
  const [configPos, setConfigPos] = useState<CatConfiguracion[]>([]);
  const [visited, setVisited] = useState<Set<number>>(new Set([1]));
  const [accordionExpanded, setAccordionExpanded] = useState(true);

  const r1Ref = useRef<HTMLInputElement>(null);
  const r2Ref = useRef<HTMLInputElement>(null);
  const r3Ref = useRef<HTMLInputElement>(null);
  const r4Ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const [m, a, v, r, c, med] = await Promise.all([
        catalogoRepo.marcas(), catalogoRepo.anomalias(),
        catalogoRepo.valvulas(), catalogoRepo.reencauches(), catalogoRepo.condiciones(),
        catalogoRepo.medidas(),
      ]);
      setMarcas(m); setAnomalias(a); setValvulas(v);
      setReencauches(r); setCondiciones(c); setMedidas(med);

      let tipoV = unidadTipoVehiculo;
      let configV = unidadConfig;

      // Fallback cold-start: reconstruir tipo/config desde DB si el contexto se perdió
      if ((!tipoV || !configV) && activeCabId) {
        const cab = await inspeccionRepo.getCabecera(activeCabId);
        if (cab) {
          const unidad = await unidadRepo.getByNumero(cab.empresa_id, cab.numero_unidad);
          if (unidad) { tipoV = unidad.tipo_vehiculo; configV = unidad.configuracion; }
        }
      }

      if (tipoV && configV) {
        const cfg = await catalogoRepo.configuracion(tipoV, configV);
        setConfigPos(cfg);
      }
    })();
  }, [unidadConfig, unidadTipoVehiculo, activeCabId]);

  useEffect(() => {
    if (!data.marca) { setModelos([]); return; }
    if (marcas.length === 0) return;
    const marcaObj = marcas.find(m => m.nombre.toLowerCase() === data.marca.toLowerCase());
    if (marcaObj) {
      setModelos([]);
      catalogoRepo.modelos(marcaObj.id).then(setModelos);
    } else {
      setModelos([]);
    }
  }, [data.marca, marcas]);

  const handleNewMarca = async (nombre: string) => {
    await catalogoRepo.addMarca(nombre);
    setMarcas(await catalogoRepo.marcas());
  };

  const handleNewModelo = async (nombre: string) => {
    const marcaObj = marcas.find(m => m.nombre === data.marca);
    if (!marcaObj) return;
    await catalogoRepo.addModelo(marcaObj.id, nombre);
    setModelos(await catalogoRepo.modelos(marcaObj.id));
  };

  const handleNewMedida = async (nombre: string) => {
    await catalogoRepo.addMedida(nombre);
    setMedidas(await catalogoRepo.medidas());
  };

  const handleNewReencauche = async (nombre: string) => {
    await catalogoRepo.addReencauche(nombre);
    setReencauches(await catalogoRepo.reencauches());
  };

  const loadAll = useCallback(async () => {
    if (!activeCabId) return;
    const neumaticos = await inspeccionRepo.listNeumaticos(activeCabId);
    const newStore: Record<number, Record<string, string>> = {};
    for (const n of neumaticos) {
      newStore[n.posicion] = {
        codigo: n.codigo ?? '', r1: n.r1?.toString() ?? '', r2: n.r2?.toString() ?? '',
        r3: n.r3?.toString() ?? '', r4: n.r4?.toString() ?? '', presion: n.presion?.toString() ?? '',
        tapaValvula: n.tapa_valvula ?? '', anomalia: n.anomalia ?? '', marca: n.marca ?? '',
        modelo: n.modelo ?? '', condicion: n.condicion ?? '',
        reencauche: n.reencauche ?? '', medida: n.medida ?? '',
      };
    }
    setStore(newStore);
    setVisited(prev => {
      const nv = new Set(prev);
      for (const [p, d] of Object.entries(newStore)) {
        if (d.r1 || d.r2 || d.r3 || d.r4 || d.presion || d.codigo) nv.add(Number(p));
      }
      return nv;
    });
    if (newStore[pos]) setData(newStore[pos]);
  }, [activeCabId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const FILAS = configPos.map(c => c.posicion);
  const TOTAL = FILAS.length;
  const todasVistas = TOTAL > 0 && FILAS.every(f => visited.has(f));

  const flashSave = () => { setFlash(true); setTimeout(() => setFlash(false), 1400); };

  const commit = async (next: Record<string, string>) => {
    setData(next);
    setStore(s => ({ ...s, [pos]: next }));
    flashSave();
    if (activeCabId) {
      const toNum = (v: string) => v === '' ? null : Number(v);
      await inspeccionRepo.upsertNeumatico({
        cabecera_id: activeCabId, posicion: pos,
        codigo: next.codigo || null, marca: next.marca || null, modelo: next.modelo || null,
        condicion: next.condicion || null, reencauche: next.reencauche || null,
        medida: next.medida || null, r1: toNum(next.r1), r2: toNum(next.r2),
        r3: toNum(next.r3), r4: toNum(next.r4), presion: toNum(next.presion),
        tapa_valvula: next.tapaValvula || null, anomalia: next.anomalia || null,
      });
    }

    // Auto-advance: if position is complete and accordion is collapsed, jump to next incomplete
    if (!accordionExpanded) {
      const cfg = configPos.find(c => c.posicion === pos);
      const needsR4 = cfg?.tipo_eje === 'Libre';
      const rtdOk = !!(next.r1 && next.r2 && next.r3 && (!needsR4 || next.r4));
      const isComplete = rtdOk && !!next.presion;
      if (isComplete) {
        const nextIncomplete = FILAS.find(f => f !== pos && posStatus(f) !== 'completa');
        if (nextIncomplete !== undefined) {
          setTimeout(() => switchPos(nextIncomplete), 200);
        }
      }
    }
  };

  const switchPos = (n: number) => {
    setSlideDir(n > pos ? 'up' : 'down');
    const nextStore = { ...store, [pos]: data };
    setStore(nextStore);
    setVisited(v => { const nv = new Set(v); nv.add(n); return nv; });
    setPos(n);
    setData(nextStore[n] || empty());
  };

  const posIdx = FILAS.indexOf(pos);
  const prevPos = () => { if (posIdx > 0) switchPos(FILAS[posIdx - 1]); };
  const nextPos = () => { if (posIdx < FILAS.length - 1) switchPos(FILAS[posIdx + 1]); };

  const handleExit = () => navigate('/unidad');

  // Estado de cada posición para el grid del sheet
  const posStatus = (p: number): 'completa' | 'parcial' | 'vacia' => {
    const d = p === pos ? data : (store[p] || empty());
    const cfg = configPos.find(c => c.posicion === p);
    const needsR4 = cfg?.tipo_eje === 'Libre';
    const rtdOk = !!(d.r1 && d.r2 && d.r3 && (!needsR4 || d.r4));
    if (rtdOk && d.presion) return 'completa';
    if (d.r1 || d.r2 || d.r3 || d.r4 || d.presion) return 'parcial';
    return 'vacia';
  };

  const posLabel = (p: number): string => {
    const cfg = configPos.find(c => c.posicion === p);
    if (!cfg) return `${p}`;
    const eje = cfg.tipo_eje === 'Direccional' ? 'DIR' : cfg.tipo_eje === 'Libre' ? 'LIB' : 'TRC';
    return `${eje}·${cfg.lado ?? ''}`;
  };

  const statusColor = (s: 'completa' | 'parcial' | 'vacia') =>
    s === 'completa' ? GREEN : s === 'parcial' ? YELLOW : BORDER_DARK;

  const navBtn = (label: React.ReactNode, onClick: () => void, disabled: boolean) => (
    <button onClick={onClick} disabled={disabled} style={{
      background: 'none', border: 'none', color: disabled ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.85)',
      cursor: disabled ? 'default' : 'pointer',
      minWidth: 40, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
    }}>{label}</button>
  );

  return (
    <div className="screen-enter" style={{ height: '100%', display: 'flex', flexDirection: 'column', background: SCREEN_DARK, fontFamily: MONO, overflow: 'clip' }}>

      {/* Header */}
      <div style={{ background: NAVY, padding: 'calc(10px + env(safe-area-inset-top, 0px)) 14px 10px', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <button
          aria-label="Volver"
          onClick={handleExit}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.9)', cursor: 'pointer', minWidth: 40, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M13 4l-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>Inspección</div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, display: 'flex', gap: 6, alignItems: 'center', marginTop: 1 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {empresa?.nombre} · Unidad {unidadNumero}
            </span>
            {flash && <span style={{ color: YELLOW, fontWeight: 800, fontSize: 10, flexShrink: 0 }}>✓</span>}
          </div>
        </div>

        {/* Pill de navegación — flechas +/-1, centro tappable abre el sheet */}
        <div style={{ display: 'flex', alignItems: 'center', background: ORANGE, borderRadius: 10, padding: '0 2px', flexShrink: 0 }}>
          {navBtn(
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M9 2l-5 5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
            prevPos, posIdx <= 0,
          )}
          <button
            onClick={() => setShowSheet(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center', minWidth: 44, padding: '4px 0', fontFamily: MONO }}
          >
            <div style={{ color: '#fff', fontWeight: 900, fontSize: 20, lineHeight: 1 }}>{TOTAL > 0 ? pos : '—'}</div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: 700, letterSpacing: '0.04em' }}>de {TOTAL}</div>
          </button>
          {navBtn(
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
            nextPos, posIdx >= FILAS.length - 1,
          )}
        </div>
      </div>

      {/* Formulario — key={pos} dispara remount + animación de slide */}
      <div
        key={pos}
        className={slideDir ? `form-slide-${slideDir}` : ''}
        style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      >
        <FormBody
          data={data}
          commit={commit}
          marcas={marcas}
          modelos={modelos}
          medidas={medidas}
          reencauches={reencauches}
          anomalias={anomalias}
          valvulas={valvulas}
          condiciones={condiciones}
          r1Ref={r1Ref}
          r2Ref={r2Ref}
          r3Ref={r3Ref}
          r4Ref={r4Ref}
          onNewMarca={handleNewMarca}
          onNewModelo={handleNewModelo}
          onNewMedida={handleNewMedida}
          onNewReencauche={handleNewReencauche}
          onAccordionChange={setAccordionExpanded}
        />
      </div>

      {/* Footer — solo cuando todas las posiciones han sido visitadas */}
      {todasVistas && (
        <div style={{ padding: `10px 14px calc(10px + env(safe-area-inset-bottom, 0px))`, background: SCREEN_DARK, borderTop: `1px solid ${BORDER_DARK}`, flexShrink: 0 }}>
          <button
            onClick={handleExit}
            style={{ width: '100%', background: YELLOW, color: NAVY, border: 'none', borderRadius: 14, padding: 14, fontWeight: 800, fontSize: 15, letterSpacing: '0.04em', cursor: 'pointer', fontFamily: MONO }}
          >
            BUSCAR OTRA UNIDAD →
          </button>
        </div>
      )}

      {/* Bottom sheet — grid de posiciones */}
      {showSheet && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(5,10,18,0.72)', zIndex: 50, display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setShowSheet(false)}
        >
          <div
            className="sheet-enter"
            style={{ background: FIELD_DARK, borderRadius: '16px 16px 0 0', width: '100%', padding: `16px 16px calc(24px + env(safe-area-inset-bottom, 0px))`, boxSizing: 'border-box' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: BORDER_DARK, margin: '0 auto 14px' }} />
            <div style={{ fontSize: 10, fontWeight: 800, color: LABEL_BLUE, letterSpacing: '0.14em', textAlign: 'center', marginBottom: 14 }}>
              POSICIONES — {FILAS.filter(p => posStatus(p) === 'completa').length}/{TOTAL} completas
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {FILAS.map(p => {
                const status = posStatus(p);
                const isCurrent = p === pos;
                return (
                  <button
                    key={p}
                    onClick={() => { setShowSheet(false); if (p !== pos) switchPos(p); }}
                    style={{
                      background: isCurrent ? 'rgba(240,104,34,0.18)' : SCREEN_DARK,
                      border: `2px solid ${isCurrent ? ORANGE : BORDER_DARK}`,
                      borderRadius: 10, padding: '10px 12px', cursor: 'pointer', fontFamily: MONO,
                      textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      minHeight: 52,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 800, color: isCurrent ? ORANGE : LABEL_BLUE, letterSpacing: '0.1em', marginBottom: 2 }}>
                        {posLabel(p)}
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: isCurrent ? ORANGE : VALUE_COLOR, lineHeight: 1 }}>
                        {p}
                      </div>
                    </div>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: statusColor(status), flexShrink: 0 }} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
