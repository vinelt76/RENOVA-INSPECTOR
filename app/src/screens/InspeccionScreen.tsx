import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../state/useApp';
import { inspeccionRepo } from '../db/repos/inspeccionRepo';
import { catalogoRepo } from '../db/repos/catalogoRepo';
import { unidadRepo } from '../db/repos/unidadRepo';
import { drainSyncQueue } from '../sync/drainQueue';
import { waitForUmbralesPendientes } from '../sync/pullUmbrales';
import { supabaseEnabled } from '../sync/supabaseClient';
import { MONO, NAVY, ORANGE, YELLOW, GREEN, RED, SCREEN_DARK, FIELD_DARK, BORDER_DARK, LABEL_BLUE, VALUE_COLOR } from '../theme';
import type { CatMarca, CatModelo, CatMedida, CatReencauche, CatAnomalia, CatValvula, CatConfiguracion, CatCondicion } from '../db/schema';
import FormBody from './FormBody';
import catalogoFlota from '../db/seed_data/catalogo_flota.json';

const empty = (): Record<string, string> => ({
  codigo: '', r1: '', r2: '', r3: '', r4: '',
  presion: '', tapaValvula: '', anomalia: '',
  marca: '', modelo: '', condicion: '', reencauche: '', medida: '',
});

export default function InspeccionScreen() {
  const { cabeceraId } = useParams<{ cabeceraId: string }>();
  const { empresa, empresaId, unidadNumero, unidadConfig, unidadTipoVehiculo, cabeceraId: ctxCabId } = useApp();
  const navigate = useNavigate();
  const activeCabId = cabeceraId ?? ctxCabId;

  const [pos, setPos] = useState(1);
  const [data, setData] = useState<Record<string, string>>(empty());
  // Último estado REAL de la posición actual: los commits llegan como parches
  // desde callbacks diferidos (blur del autocomplete) y no pueden fiarse del
  // snapshot de `data` de su render (lost update).
  const dataRef = useRef<Record<string, string>>(empty());
  const [store, setStore] = useState<Record<number, Record<string, string>>>({});
  // Posiciones que el inspector ya visitó/vio en esta sesión — independiente de si
  // quedaron completas. Habilita "cambiar de unidad" para poder probar el flujo
  // sin llenar todos los campos obligatoriamente (ver commit de este cambio).
  const [visitedPositions, setVisitedPositions] = useState<Set<number>>(new Set([1]));
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

  // Envío mínimo a Supabase (integración demo) — sin VITE_SUPABASE_URL/ANON_KEY
  // configuradas, supabaseEnabled es false y este estado nunca sale de 'idle'
  // (cero cambio de comportamiento respecto a hoy).
  const [syncState, setSyncState] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [syncRevision, setSyncRevision] = useState(0);

  const r1Ref = useRef<HTMLInputElement>(null);
  const r2Ref = useRef<HTMLInputElement>(null);
  const r3Ref = useRef<HTMLInputElement>(null);
  const r4Ref = useRef<HTMLInputElement>(null);
  const presionRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const [m, a, v, r, c, med] = await Promise.all([
        catalogoRepo.marcas(), catalogoRepo.anomalias(),
        catalogoRepo.valvulas(), catalogoRepo.reencauches(), catalogoRepo.condiciones(),
        catalogoRepo.medidas(),
      ]);
      setMarcas(m); setAnomalias(a); setValvulas(v);
      setReencauches(r); setCondiciones(c);
      setMedidas(med.length ? med : (catalogoFlota.medidas as string[]).map(nombre => ({ id: nombre, nombre })));

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
    if (Object.keys(newStore).length > 0) {
      setVisitedPositions(v => new Set([...v, ...Object.keys(newStore).map(Number)]));
    }
    if (newStore[pos]) { setData(newStore[pos]); dataRef.current = newStore[pos]; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCabId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const FILAS = configPos.map(c => c.posicion);
  const TOTAL = FILAS.length;

  const flashSave = () => { setFlash(true); setTimeout(() => setFlash(false), 1400); };

  // commit por PARCHE: merge contra dataRef (estado real), nunca contra el
  // snapshot del render del caller — evita que un blur diferido pise teclas.
  const commit = async (patch: Record<string, string>) => {
    const next = { ...dataRef.current, ...patch };
    dataRef.current = next;
    setData(next);
    setStore(s => ({ ...s, [pos]: next }));
    flashSave();
    if (activeCabId && empresaId) {
      // Si el pull de umbrales de la empresa (disparado sin esperar al elegirla,
      // AppContext.setEmpresa) todavía está en vuelo, esperarlo acá (con tope) para
      // no snapshotear el umbral sembrado 4/7/8 en vez del real de la empresa —
      // race detectada en code review de task_17 (2026-07-11). Resuelve al toque
      // si ya terminó (caso normal: buscar unidad + tipear odómetro ya da tiempo).
      await waitForUmbralesPendientes();
      const toNum = (v: string) => v === '' ? null : Number(v);
      await inspeccionRepo.upsertNeumatico({
        empresa_id: empresaId,
        cabecera_id: activeCabId, posicion: pos,
        codigo: next.codigo || null, marca: next.marca || null, modelo: next.modelo || null,
        condicion: next.condicion || null, reencauche: next.reencauche || null,
        medida: next.medida || null, r1: toNum(next.r1), r2: toNum(next.r2),
        r3: toNum(next.r3), r4: toNum(next.r4), presion: toNum(next.presion),
        tapa_valvula: next.tapaValvula || null, anomalia: next.anomalia || null,
      });
      setSyncRevision(r => r + 1);
    }
  };

  const switchPos = useCallback((n: number, focusR1 = false) => {
    setSlideDir(n > pos ? 'up' : 'down');
    const nextStore = { ...store, [pos]: dataRef.current };
    setStore(nextStore);
    setPos(n);
    setVisitedPositions(v => v.has(n) ? v : new Set(v).add(n));
    const nextData = nextStore[n] || empty();
    dataRef.current = nextData;
    setData(nextData);
    if (focusR1) {
      // El form remonta (key={pos}); esperar al remount para enfocar R1.
      // Aumentamos ligeramente el delay para evitar que compita con el resize del teclado.
      setTimeout(() => { r1Ref.current?.focus(); r1Ref.current?.select(); }, 300);
    }
  }, [pos, store]);

  const posIdx = FILAS.indexOf(pos);
  const prevPos = () => { if (posIdx > 0) switchPos(FILAS[posIdx - 1]); };
  const nextPos = () => { if (posIdx < FILAS.length - 1) switchPos(FILAS[posIdx + 1]); };

  const handleExit = () => navigate('/unidad');

  // Estado de cada posición para el grid del sheet.
  // R4 es opcional en cualquier eje (reglas_negocio.md §1): A/B/C alcanzan
  // para marcar "completa", sin importar tipo_eje.
  const posStatus = (p: number): 'completa' | 'parcial' | 'vacia' => {
    const d = p === pos ? data : (store[p] || empty());
    const rtdOk = !!(d.r1 && d.r2 && d.r3);
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

  const completas = FILAS.filter(p => posStatus(p) === 'completa').length;

  // Reset del indicador al entrar a una inspección distinta.
  useEffect(() => { setSyncState('idle'); }, [activeCabId]);
  useEffect(() => { setVisitedPositions(new Set([1])); }, [activeCabId]);

  // Cambiar de unidad NO exige campos completos, solo haber recorrido todas las
  // posiciones (permite probar el flujo sin llenar RTD/presión/anomalía/etc.).
  // La validación de campos obligatorios queda reservada al guardado final.
  const allPositionsViewed = TOTAL > 0 && FILAS.every(p => visitedPositions.has(p));
  const canChangeUnit = allPositionsViewed;

  // Envío a Supabase: cada guardado local (vía `commit`) ya encoló la cabecera en
  // sync_queue (inspeccionRepo, task_17); este efecto solo dispara el drenado con
  // debounce para que se sienta "en vivo" sin esperar al próximo evento `online` o
  // arranque de app. Si falla, la fila queda en la cola con backoff — no se pierde.
  useEffect(() => {
    if (!supabaseEnabled || !activeCabId) return;
    if (syncRevision === 0) return;
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(async () => {
      setSyncState('sending');
      const res = await drainSyncQueue();
      setSyncState(res.pendientes === 0 ? 'ok' : 'error');
    }, 1200);
    return () => { if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCabId, syncRevision]);

  const navBtn = (label: React.ReactNode, onClick: () => void, disabled: boolean) => (
    <button onClick={onClick} disabled={disabled} className="pressable" style={{
      background: 'none', border: 'none', color: disabled ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.9)',
      cursor: disabled ? 'default' : 'pointer',
      minWidth: 48, minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
    }}>{label}</button>
  );

  return (
    <div className="screen-enter" style={{ height: '100%', display: 'flex', flexDirection: 'column', background: SCREEN_DARK, fontFamily: MONO, overflow: 'hidden' }}>

      {/* Header — solo identidad + salida (la navegación vive abajo, zona del pulgar) */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ background: NAVY, padding: 'calc(10px + env(safe-area-inset-top, 0px)) 14px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            aria-label="Volver"
            onClick={handleExit}
            className="pressable"
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.9)', cursor: 'pointer', minWidth: 40, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M13 4l-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>Inspección</div>
            <div style={{ color: LABEL_BLUE, fontSize: 11, display: 'flex', gap: 6, alignItems: 'center', marginTop: 1 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {empresa?.nombre} · Unidad {unidadNumero}
              </span>
            </div>
          </div>

          {/* Tick de guardado — feedback de autosave local (SQLite) */}
          {flash && (
            <div className="tick-in" aria-label="Guardado" style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, background: 'rgba(244,184,33,0.14)', borderRadius: 6, padding: '4px 8px' }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2 6.5L4.5 9L10 3" stroke={YELLOW} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span style={{ color: YELLOW, fontWeight: 800, fontSize: 10, letterSpacing: '0.06em' }}>GUARDADO</span>
            </div>
          )}

          {/* Estado de envío a Supabase — solo visible si la integración está configurada (.env) */}
          {supabaseEnabled && syncState !== 'idle' && (
            <div aria-label="Estado de sincronización" style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, background: syncState === 'error' ? 'rgba(229,72,77,0.16)' : 'rgba(31,157,107,0.16)', borderRadius: 6, padding: '4px 8px' }}>
              <span style={{ color: syncState === 'sending' ? LABEL_BLUE : syncState === 'ok' ? GREEN : RED, fontWeight: 800, fontSize: 9, letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                {syncState === 'sending' ? 'ENVIANDO A SUPABASE…' : syncState === 'ok' ? '☁ SINCRONIZADO' : '⚠ ERROR DE ENVÍO'}
              </span>
            </div>
          )}
        </div>
        <div className="hazard-edge" />
      </div>

      {/* Formulario — key={pos} dispara remount + animación de slide */}
      <div
        key={pos}
        className={slideDir ? `form-slide-${slideDir}` : ''}
        style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
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
          presionRef={presionRef}
          onNewMarca={handleNewMarca}
          onNewModelo={handleNewModelo}
          onNewMedida={handleNewMedida}
          onNewReencauche={handleNewReencauche}
          showBuscarOtra={canChangeUnit && posIdx === FILAS.length - 1}
          onBuscarOtra={handleExit}
        />
      </div>

      {/* Barra de acción inferior — navegación de posición en zona del pulgar (DESIGN.md §7) */}
      <div style={{ flexShrink: 0, background: NAVY, padding: `8px 14px calc(8px + env(safe-area-inset-bottom, 0px))` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {navBtn(
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M11.5 3l-6 6 6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
            prevPos, posIdx <= 0,
          )}
          <button
            onClick={() => setShowSheet(true)}
            className="pressable chamfer"
            style={{ flex: 1, background: ORANGE, border: 'none', cursor: 'pointer', textAlign: 'center', padding: '7px 0 6px', fontFamily: MONO }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 8 }}>
              <span style={{ color: '#fff', fontWeight: 900, fontSize: 24, lineHeight: 1, fontVariantNumeric: 'tabular-nums' as const }}>{TOTAL > 0 ? pos : '—'}</span>
              <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: 800, letterSpacing: '0.06em' }}>/ {TOTAL} · {posLabel(pos)}</span>
            </div>
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', marginTop: 2 }}>
              {completas}/{TOTAL} COMPLETAS — TOCA PARA ELEGIR
            </div>
          </button>
          {navBtn(
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M6.5 3l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
            nextPos, posIdx >= FILAS.length - 1,
          )}
        </div>
      </div>

      {/* Selector de posiciones — grid en zona media de la pantalla (alcance de pulgar) */}
      {showSheet && (
        <div
          className="scrim-enter"
          style={{ position: 'fixed', inset: 0, background: 'rgba(5,10,18,0.72)', zIndex: 50, display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setShowSheet(false)}
        >
          <div
            className="sheet-enter"
            style={{ background: FIELD_DARK, borderRadius: '16px 16px 0 0', width: '100%', minHeight: '62%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', boxShadow: '0 -8px 24px rgba(0,0,0,0.4)', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="hazard-edge" />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: `12px 16px calc(20px + env(safe-area-inset-bottom, 0px))` }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: BORDER_DARK, margin: '0 auto 16px' }} />
              <div style={{ fontSize: 10, fontWeight: 800, color: LABEL_BLUE, letterSpacing: '0.14em', textAlign: 'center', marginBottom: 16 }}>
                POSICIONES — {completas}/{TOTAL} completas
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {FILAS.map(p => {
                  const status = posStatus(p);
                  const isCurrent = p === pos;
                  return (
                    <button
                      key={p}
                      onClick={() => { setShowSheet(false); if (p !== pos) switchPos(p); }}
                      className="pressable"
                      style={{
                        background: isCurrent ? 'rgba(240,104,34,0.18)' : SCREEN_DARK,
                        border: `2px solid ${isCurrent ? ORANGE : BORDER_DARK}`,
                        borderRadius: 10, padding: '12px 14px', cursor: 'pointer', fontFamily: MONO,
                        textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        minHeight: 58,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 800, color: isCurrent ? ORANGE : LABEL_BLUE, letterSpacing: '0.1em', marginBottom: 2 }}>
                          {posLabel(p)}
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 900, color: isCurrent ? ORANGE : VALUE_COLOR, lineHeight: 1, fontVariantNumeric: 'tabular-nums' as const }}>
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
        </div>
      )}
    </div>
  );
}
