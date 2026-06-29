import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { inspeccionRepo } from '../db/repos/inspeccionRepo';
import { catalogoRepo } from '../db/repos/catalogoRepo';
import { unidadRepo } from '../db/repos/unidadRepo';
import { MONO, NAVY, ORANGE, YELLOW, BORDER, MUTED, GREEN } from '../theme';
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

  const [marcas, setMarcas] = useState<CatMarca[]>([]);
  const [modelos, setModelos] = useState<CatModelo[]>([]);
  const [medidas, setMedidas] = useState<CatMedida[]>([]);
  const [reencauches, setReencauches] = useState<CatReencauche[]>([]);
  const [anomalias, setAnomalias] = useState<CatAnomalia[]>([]);
  const [valvulas, setValvulas] = useState<CatValvula[]>([]);
  const [condiciones, setCondiciones] = useState<CatCondicion[]>([]);
  const [configPos, setConfigPos] = useState<CatConfiguracion[]>([]);
  const [visited, setVisited] = useState<Set<number>>(new Set([1]));

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

      // Fallback para cold-start: si el contexto se perdió al cerrar la app,
      // reconstruir tipo/config desde la DB usando el cabeceraId de la URL.
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

  // Cargar modelos cuando cambia la marca seleccionada
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
    // Marcar como visitadas las posiciones que ya tienen algún dato guardado
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
  useEffect(() => { loadNeumatico(pos); }, [pos, loadNeumatico]);

  const FILAS = configPos.map(c => c.posicion);
  const TOTAL = FILAS.length;

  const inspeccionada = (n: number) => {
    const d = n === pos ? data : store[n];
    return !!(d && (d.r1 || d.r2 || d.r3 || d.r4 || d.presion));
  };
  const hechas = FILAS.filter(inspeccionada).length;
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
  };

  const switchPos = (n: number) => {
    setStore(s => ({ ...s, [pos]: data }));
    setVisited(v => { const nv = new Set(v); nv.add(n); return nv; });
    setPos(n);
  };

  const posIdx = FILAS.indexOf(pos);
  const prevPos = () => { if (posIdx > 0) switchPos(FILAS[posIdx - 1]); };
  const nextPos = () => { if (posIdx < FILAS.length - 1) switchPos(FILAS[posIdx + 1]); };

  const finalizar = () => navigate('/unidad');

  const navBtn = (label: React.ReactNode, onClick: () => void, disabled: boolean) => (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: 'none', border: 'none', color: disabled ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.85)',
        cursor: disabled ? 'default' : 'pointer',
        minWidth: 40, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
      }}
    >{label}</button>
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#eef1f6', fontFamily: MONO, overflow: 'clip' }}>

      {/* Header */}
      <div style={{ background: NAVY, padding: 'calc(10px + env(safe-area-inset-top, 0px)) 14px 10px', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <button
          aria-label="Volver"
          onClick={() => navigate('/unidad')}
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

        {/* Navegación de posición */}
        <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '0 2px', flexShrink: 0 }}>
          {navBtn(<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M9 2l-5 5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>, prevPos, posIdx <= 0)}
          <div style={{ textAlign: 'center', minWidth: 44, padding: '4px 0' }}>
            <div style={{ color: '#fff', fontWeight: 900, fontSize: 20, lineHeight: 1 }}>{TOTAL > 0 ? pos : '—'}</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: 700, letterSpacing: '0.04em' }}>de {TOTAL}</div>
          </div>
          {navBtn(<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>, nextPos, posIdx >= FILAS.length - 1)}
        </div>
      </div>

      {/* Indicador de posición (eje/lado) */}
      {configPos.length > 0 && (() => {
        const cur = configPos.find(c => c.posicion === pos);
        if (!cur) return null;
        const tag = cur.tipo_eje === 'Direccional' ? 'DIR' : cur.tipo_eje === 'Libre' ? 'LIB' : 'TRC';
        const estado = inspeccionada(pos);
        return (
          <div style={{ background: estado ? NAVY : ORANGE, padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.12em' }}>{tag}</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>·</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>{cur.lado ?? ''}</span>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.06em' }}>
              {hechas}/{TOTAL} con datos
            </span>
          </div>
        );
      })()}

      {/* Formulario scrollable */}
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
      />

      {/* Footer */}
      <div style={{ padding: `10px 14px calc(10px + env(safe-area-inset-bottom, 0px))`, background: '#eef1f6', borderTop: `1px solid ${BORDER}`, flexShrink: 0 }}>
        {todasVistas ? (
          <button
            onClick={finalizar}
            style={{ width: '100%', background: GREEN, color: '#fff', border: 'none', borderRadius: 14, padding: 14, fontWeight: 800, fontSize: 15, letterSpacing: '0.04em', cursor: 'pointer', fontFamily: MONO }}
          >
            FINALIZAR INSPECCIÓN ✓
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px 4px' }}>
            <span style={{ fontSize: 12, color: MUTED, fontWeight: 700 }}>
              {visited.size} de {TOTAL} posiciones revisadas
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
