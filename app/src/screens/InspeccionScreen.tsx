import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { inspeccionRepo } from '../db/repos/inspeccionRepo';
import { catalogoRepo } from '../db/repos/catalogoRepo';
import { MONO, NAVY, ORANGE, YELLOW, BORDER, MUTED, GREEN } from '../theme';
import type { CatMarca, CatModelo, CatMedida, CatReencauche, CatAnomalia, CatValvula, CatConfiguracion, CatCondicion } from '../db/schema';
import FormBody from './FormBody';
import GrillaBody from './GrillaBody';

const empty = (): Record<string, string> => ({
  codigo: '', r1: '', r2: '', r3: '', r4: '',
  presion: '', tapaValvula: '', anomalia: '',
  marca: '', modelo: '', condicion: '', reencauche: '', medida: '',
});

function WheelBtn({ n, tag, state, onClick }: { n: number; tag: string; state: string; onClick: () => void }) {
  const isCur = state === 'current';
  const isDone = state === 'done';
  const bg = isCur ? ORANGE : isDone ? NAVY : '#fff';
  const fg = isCur || isDone ? '#fff' : MUTED;
  const bd = isCur ? ORANGE : isDone ? NAVY : BORDER;
  return (
    <button onClick={onClick} style={{ width: 46, height: 54, borderRadius: 9, background: bg, border: `2px solid ${bd}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, cursor: 'pointer', fontFamily: MONO, flexShrink: 0, transition: 'background 0.12s' }}>
      <span style={{ fontSize: 17, fontWeight: 900, color: fg, lineHeight: 1 }}>{n}</span>
      <span style={{ fontSize: 7.5, fontWeight: 800, color: isCur || isDone ? 'rgba(255,255,255,0.7)' : MUTED, letterSpacing: '0.04em' }}>{tag}</span>
    </button>
  );
}

const MODO_KEY = 'renova_modo_inspeccion';

export default function InspeccionScreen() {
  const { cabeceraId } = useParams<{ cabeceraId: string }>();
  const { empresa, unidadNumero, unidadConfig, unidadTipoVehiculo, cabeceraId: ctxCabId } = useApp();
  const navigate = useNavigate();
  const activeCabId = cabeceraId ?? ctxCabId;

  const [modo, setModo] = useState<'form' | 'grilla'>(() => (localStorage.getItem(MODO_KEY) as 'form' | 'grilla') || 'form');
  const [pos, setPos] = useState(1);
  const [data, setData] = useState<Record<string, string>>(empty());
  const [store, setStore] = useState<Record<number, Record<string, string>>>({});
  const [flash, setFlash] = useState(false);
  const [showSheet, setShowSheet] = useState(false);
  const [showPos, setShowPos] = useState(false);
  const [codigoEditing, setCodigoEditing] = useState(false);

  const [marcas, setMarcas] = useState<CatMarca[]>([]);
  const [modelos, setModelos] = useState<CatModelo[]>([]);
  const [medidas, setMedidas] = useState<CatMedida[]>([]);
  const [reencauches, setReencauches] = useState<CatReencauche[]>([]);
  const [anomalias, setAnomalias] = useState<CatAnomalia[]>([]);
  const [valvulas, setValvulas] = useState<CatValvula[]>([]);
  const [condiciones, setCondiciones] = useState<CatCondicion[]>([]);
  const [configPos, setConfigPos] = useState<CatConfiguracion[]>([]);

  const codigoRef = useRef<HTMLInputElement>(null);
  const r1Ref = useRef<HTMLInputElement>(null);
  const r2Ref = useRef<HTMLInputElement>(null);
  const r3Ref = useRef<HTMLInputElement>(null);
  const r4Ref = useRef<HTMLInputElement>(null);

  useEffect(() => { localStorage.setItem(MODO_KEY, modo); }, [modo]);

  useEffect(() => {
    (async () => {
      const [m, md, a, v, r, c] = await Promise.all([
        catalogoRepo.marcas(), catalogoRepo.medidas(), catalogoRepo.anomalias(),
        catalogoRepo.valvulas(), catalogoRepo.reencauches(), catalogoRepo.condiciones(),
      ]);
      setMarcas(m); setMedidas(md); setAnomalias(a); setValvulas(v);
      setReencauches(r); setCondiciones(c);
      if (unidadConfig && unidadTipoVehiculo) {
        const cfg = await catalogoRepo.configuracion(unidadTipoVehiculo, unidadConfig);
        setConfigPos(cfg);
      }
    })();
  }, [unidadConfig, empresa, unidadTipoVehiculo]);

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

  useEffect(() => {
    if (marcas.length > 0 && data.marca) {
      const marcaObj = marcas.find(m => m.nombre === data.marca);
      if (marcaObj) catalogoRepo.modelos(marcaObj.id).then(setModelos);
    }
  }, [data.marca, marcas]);

  const loadNeumatico = useCallback(async (position: number) => {
    if (!activeCabId) return;
    const existing = await inspeccionRepo.getNeumaticoByPosicion(activeCabId, position);
    if (existing) {
      const d: Record<string, string> = {
        codigo: existing.codigo ?? '', r1: existing.r1?.toString() ?? '',
        r2: existing.r2?.toString() ?? '', r3: existing.r3?.toString() ?? '',
        r4: existing.r4?.toString() ?? '', presion: existing.presion?.toString() ?? '',
        tapaValvula: existing.tapa_valvula ?? '', anomalia: existing.anomalia ?? '',
        marca: existing.marca ?? '', modelo: existing.modelo ?? '',
        condicion: existing.condicion ?? '',
        reencauche: existing.reencauche ?? '',
        medida: existing.medida ?? '',
      };
      setData(d);
      setStore(s => ({ ...s, [position]: d }));
    } else {
      setData(empty());
      setStore(s => ({ ...s, [position]: empty() }));
    }
  }, [activeCabId]);

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
    if (newStore[pos]) setData(newStore[pos]);
  }, [activeCabId]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { loadNeumatico(pos); }, [pos, loadNeumatico]);

  const POS: Record<number, { tag: string; etq: string }> = {};
  const FILAS = configPos.map(c => c.posicion);
  for (const c of configPos) {
    const tag = c.tipo_eje === 'Direccional' ? 'DIR' : c.tipo_eje === 'Libre' ? 'LIB' : 'TRC';
    const etq = c.tipo_eje === 'Direccional' ? `Dir ${c.lado?.toLowerCase() ?? ''}` : c.tipo_eje === 'Libre' ? `Libre ${c.lado?.toLowerCase() ?? ''}` : `Trac ${c.lado?.toLowerCase() ?? ''}`;
    POS[c.posicion] = { tag, etq };
  }
  const TOTAL = FILAS.length;

  const inspeccionada = (n: number) => {
    const d = n === pos ? data : store[n];
    return !!(d && (d.r1 || d.r2 || d.r3 || d.r4 || d.presion));
  };
  const completa = (p: number) => { const d = store[p] || empty(); return !!(d.r1 && d.r2 && d.r3 && d.r4 && d.presion); };
  const listas = FILAS.filter(completa).length;
  const hechas = FILAS.filter(inspeccionada).length;

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
  };

  const switchPos = (n: number) => {
    setStore(s => ({ ...s, [pos]: data }));
    setPos(n);
    setCodigoEditing(false);
    setShowPos(false);
  };

  const wheelState = (n: number) => (n === pos ? 'current' : inspeccionada(n) ? 'done' : 'pending');
  const finalizar = () => navigate('/unidad');

  const toggleBtn = (m: 'form' | 'grilla', label: string) => (
    <button onClick={() => setModo(m)} style={{ padding: '6px 14px', fontSize: 11, fontWeight: 800, fontFamily: MONO, letterSpacing: '0.06em', border: 'none', borderRadius: 7, cursor: 'pointer', transition: 'background 0.15s', background: modo === m ? ORANGE : 'rgba(255,255,255,0.15)', color: modo === m ? '#fff' : 'rgba(255,255,255,0.6)', minHeight: 32 }}>{label}</button>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: MONO }}>
      <div style={{ width: 'min(410px, 100%)', height: 'min(820px, 96vh)', background: '#eef1f6', borderRadius: 26, overflow: 'hidden', boxShadow: '0 24px 64px rgba(21,35,63,0.30)', display: 'flex', flexDirection: 'column', position: 'relative' }}>

        <div style={{ background: NAVY, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button aria-label="Volver" onClick={() => navigate('/unidad')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.9)', fontSize: 22, cursor: 'pointer', minWidth: 40, minHeight: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>←</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 14, letterSpacing: '-0.01em' }}>Inspección</div>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 1, display: 'flex', gap: 6, alignItems: 'center' }}>
              <span>{empresa?.nombre} · Unidad {unidadNumero}</span>
              {flash && <span style={{ color: YELLOW, fontWeight: 700, fontSize: 10 }}>✓ Guardado</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: 3 }}>
            {toggleBtn('form', 'FORM')}{toggleBtn('grilla', 'GRILLA')}
          </div>
          {modo === 'form' ? (
            <button onClick={() => setShowPos(true)} style={{ background: ORANGE, border: 'none', borderRadius: 9, padding: '4px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', flexShrink: 0, fontFamily: MONO, minHeight: 40, justifyContent: 'center' }}>
              <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 8, fontWeight: 800, letterSpacing: '0.08em' }}>POS.</span>
              <span style={{ color: '#fff', fontSize: 16, fontWeight: 900, lineHeight: 1.1 }}>{pos}</span>
            </button>
          ) : (
            <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 9, padding: '5px 10px', textAlign: 'center', flexShrink: 0 }}>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 8, fontWeight: 800, letterSpacing: '0.08em' }}>LISTAS</div>
              <div style={{ color: '#fff', fontSize: 14, fontWeight: 900, lineHeight: 1.1 }}>{listas}<span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>/{TOTAL}</span></div>
            </div>
          )}
        </div>

        {modo === 'form' ? (
          <FormBody data={data} commit={commit} marcas={marcas} modelos={modelos} medidas={medidas} reencauches={reencauches} anomalias={anomalias} valvulas={valvulas} condiciones={condiciones} showSheet={showSheet} setShowSheet={setShowSheet} codigoEditing={codigoEditing} setCodigoEditing={setCodigoEditing} codigoRef={codigoRef} r1Ref={r1Ref} r2Ref={r2Ref} r3Ref={r3Ref} r4Ref={r4Ref} onNewMarca={handleNewMarca} onNewModelo={handleNewModelo} onNewMedida={handleNewMedida} onNewReencauche={handleNewReencauche} />
        ) : (
          <GrillaBody cabeceraId={activeCabId} store={store} setStore={setStore} flashSave={flashSave} POS={POS} FILAS={FILAS} marcas={marcas} modelos={modelos} medidas={medidas} reencauches={reencauches} anomalias={anomalias} valvulas={valvulas} condiciones={condiciones} upsertNeumatico={inspeccionRepo.upsertNeumatico} />
        )}

        {modo === 'form' && (
          <div style={{ flexShrink: 0, padding: '10px 14px', background: '#eef1f6', borderTop: `1px solid ${BORDER}` }}>
            <button onClick={() => setShowPos(true)} style={{ width: '100%', background: NAVY, color: '#fff', border: 'none', borderRadius: 14, padding: '14px', fontWeight: 800, fontSize: 14, letterSpacing: '0.04em', cursor: 'pointer', fontFamily: MONO }}>
              MAPA DE LA UNIDAD →
            </button>
          </div>
        )}

        {modo === 'grilla' && (
          <div style={{ flexShrink: 0, padding: 12, background: '#eef1f6', borderTop: `1px solid ${BORDER}` }}>
            <button onClick={finalizar} style={{ width: '100%', background: listas === TOTAL ? GREEN : NAVY, color: '#fff', border: 'none', borderRadius: 14, padding: '15px', fontWeight: 800, fontSize: 15, letterSpacing: '0.04em', cursor: 'pointer', fontFamily: MONO }}>
              {listas === TOTAL ? 'FINALIZAR INSPECCIÓN ✓' : `FINALIZAR · faltan ${TOTAL - listas}`}
            </button>
          </div>
        )}

        {showPos && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,16,30,0.55)', display: 'flex', alignItems: 'flex-end', zIndex: 60 }} onClick={() => setShowPos(false)}>
            <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', padding: '18px 18px 26px', boxSizing: 'border-box' }} onClick={e => e.stopPropagation()}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: BORDER, margin: '0 auto 16px' }} />
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 2 }}>
                <div style={{ fontWeight: 900, fontSize: 15, color: NAVY }}>Mapa de la unidad</div>
                <div style={{ fontSize: 11, fontWeight: 800, color: ORANGE }}>{hechas} / {TOTAL} listas</div>
              </div>
              <div style={{ fontSize: 12, color: MUTED, marginBottom: 14 }}>Unidad {unidadNumero} · {unidadConfig} · toca una llanta para ir</div>

              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '6px 0 2px' }}>
                <div style={{ position: 'absolute', top: 30, bottom: 12, width: 50, background: NAVY, borderRadius: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 0, opacity: 0.92 }} />
                <div style={{ fontSize: 9, fontWeight: 800, color: MUTED, letterSpacing: '0.22em', zIndex: 1 }}>▲ FRENTE</div>
                {(() => {
                  const ejeGroups = new Map<string, CatConfiguracion[]>();
                  for (const c of configPos) {
                    const arr = ejeGroups.get(c.tipo_eje) || [];
                    arr.push(c);
                    ejeGroups.set(c.tipo_eje, arr);
                  }
                  return ['Direccional', 'Tracción', 'Libre'].filter(e => ejeGroups.has(e)).map(eje => {
                    const posiciones = ejeGroups.get(eje)!;
                    const izq = posiciones.filter(p => p.lado === 'Izq').sort((a, b) => a.posicion - b.posicion);
                    const der = posiciones.filter(p => p.lado === 'Der').sort((a, b) => a.posicion - b.posicion);
                    return (
                      <div key={eje} style={{ display: 'flex', alignItems: 'center', width: '100%', zIndex: 1 }}>
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                          {izq.map(p => <WheelBtn key={p.posicion} n={p.posicion} tag={POS[p.posicion]?.tag ?? ''} state={wheelState(p.posicion)} onClick={() => switchPos(p.posicion)} />)}
                        </div>
                        <div style={{ width: 54, flexShrink: 0 }} />
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start', gap: 6 }}>
                          {der.map(p => <WheelBtn key={p.posicion} n={p.posicion} tag={POS[p.posicion]?.tag ?? ''} state={wheelState(p.posicion)} onClick={() => switchPos(p.posicion)} />)}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              <div style={{ marginTop: 18, display: 'flex', gap: 16, justifyContent: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: MUTED }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: ORANGE }} /> Actual
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: MUTED }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: NAVY }} /> Inspeccionada
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: MUTED }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: '#fff', border: `2px solid ${BORDER}` }} /> Pendiente
                </span>
              </div>

              <button onClick={finalizar} style={{ width: '100%', background: listas === TOTAL ? GREEN : NAVY, color: '#fff', border: 'none', borderRadius: 12, padding: 14, fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: MONO, marginTop: 16, minHeight: 48 }}>
                {listas === TOTAL ? 'FINALIZAR INSPECCIÓN ✓' : `FINALIZAR · faltan ${TOTAL - listas}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
