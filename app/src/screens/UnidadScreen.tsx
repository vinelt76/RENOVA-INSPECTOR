import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/useApp';
import { unidadRepo } from '../db/repos/unidadRepo';
import { inspeccionRepo } from '../db/repos/inspeccionRepo';
import { catalogoRepo } from '../db/repos/catalogoRepo';
import { localDate } from '../db/sqlite';
import { BEBAS, MONO, NAVY, ORANGE, YELLOW, SCREEN_DARK, FIELD_DARK, LABEL_BLUE, BORDER_DARK, VALUE_COLOR } from '../theme';
import type { Unidad, CatConfiguracion } from '../db/schema';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';


function SearchIcon({ active }: { active: boolean }) {
  const color = active ? ORANGE : LABEL_BLUE;
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ marginRight: 10, flexShrink: 0 }} aria-hidden="true">
      <circle cx="7.5" cy="7.5" r="5" stroke={color} strokeWidth="2" />
      <path d="M11.5 11.5L16 16" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function fmtFecha(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-PE', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}
function fmtKm(n: number) {
  return Number(n).toLocaleString('es-PE') + ' km';
}

export default function UnidadScreen() {
  const { empresaId, empresa, setUnidad, setCabecera, clearUnidad } = useApp();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [odometro, setOdometro] = useState('');
  const [config, setConfig] = useState('');
  const [sugerencias, setSugerencias] = useState<Unidad[]>([]);
  const [showSugerencias, setShowSugerencias] = useState(false);
  const [ultimaInsp, setUltimaInsp] = useState<{ fecha: string; odometro: number; cabeceraId: string } | null>(null);
  const [configs, setConfigs] = useState<CatConfiguracion[]>([]);
  const [fotoUnidad, setFotoUnidad] = useState<string | null>(null);
  const [recientes, setRecientes] = useState<Unidad[]>([]);
  const [focusedField, setFocusedField] = useState<'search' | 'odometro' | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const latestQuery = useRef('');

  useEffect(() => {
    catalogoRepo.configuracionMvp().then(setConfigs);
  }, []);

  const refreshHoy = useCallback(() => {
    if (empresaId) unidadRepo.hoy(empresaId).then(setRecientes);
  }, [empresaId]);

  useEffect(() => { refreshHoy(); }, [refreshHoy]);

  // Refresca la lista al volver desde la pantalla de inspección
  useEffect(() => {
    window.addEventListener('focus', refreshHoy);
    return () => window.removeEventListener('focus', refreshHoy);
  }, [refreshHoy]);

  const q = query.trim();
  const showResult = q.length >= 1;
  const match = sugerencias.length === 1 && sugerencias[0].numero === q ? sugerencias[0] : null;
  const noExiste = showResult && !match && sugerencias.length === 0;

  const kmPrev = match ? (ultimaInsp?.odometro ?? 0) : 0;
  const kmActual = parseInt(odometro || '0', 10);
  const kmBajo = match && odometro.length > 0 && kmActual < kmPrev;

  const canContinue = !!match && odometro.length > 0 && !kmBajo;
  const canCreate = !!noExiste && odometro.length > 0 && !!config;

  const handleSearch = async (val: string) => {
    // Alfanumérico: CTA identifica sus buses por placa (p.ej. "AAV-803") — decisión Lote 3
    const clean = val.replace(/[^0-9a-zA-Z-]/g, '').toUpperCase();
    latestQuery.current = clean;
    setQuery(clean);
    setOdometro('');
    setConfig('');
    setUltimaInsp(null);
    if (clean.length >= 1 && empresaId) {
      const results = await unidadRepo.search(empresaId, clean);
      if (latestQuery.current !== clean) return; // resultado obsoleto
      setSugerencias(results);
      const exacto = results.find(u => u.numero === clean);
      if (exacto) {
        await selectUnidad(exacto);
        if (latestQuery.current !== clean) return; // usuario siguió escribiendo
      } else {
        setShowSugerencias(true);
      }
    } else {
      setSugerencias([]);
      setShowSugerencias(false);
    }
  };

  const selectUnidad = useCallback(async (u: Unidad) => {
    setQuery(u.numero);
    setSugerencias([u]);
    setShowSugerencias(false);
    try {
      const cabecera = await unidadRepo.getUltimaCabecera(u.empresa_id, u.numero);
      if (cabecera) {
        setUltimaInsp({ fecha: cabecera.fecha, odometro: cabecera.km_odometro ?? 0, cabeceraId: cabecera.id });
        // Inspección de HOY → se reabre la misma: prellenar el odómetro registrado
        if (cabecera.fecha === localDate()) setOdometro(String(cabecera.km_odometro ?? ''));
      } else {
        setUltimaInsp(null);
      }
    } catch (e) {
      console.error('selectUnidad error:', e);
      setUltimaInsp(null);
    }
  }, []);

  const reset = () => {
    setQuery('');
    setOdometro('');
    setConfig('');
    setSugerencias([]);
    setShowSugerencias(false);
    setUltimaInsp(null);
    inputRef.current?.focus();
  };

  const handleContinue = async () => {
    if (!match || !empresaId) return;
    // Cierra el teclado ANTES de navegar: si queda animando mientras
    // InspeccionScreen monta, el WebView de Android puede resolver el foco
    // inicial de la pantalla nueva contra el inset de teclado de la vieja.
    (document.activeElement as HTMLElement | null)?.blur();
    try {
      const fecha = localDate();
      await unidadRepo.upsert({
        numero: match.numero,
        empresa_id: empresaId,
        tipo_vehiculo: match.tipo_vehiculo,
        configuracion: match.configuracion,
        odometro_ultimo: kmActual,
        ultima_fecha: fecha,
      });

      let cabeceraId: string;
      if (ultimaInsp && ultimaInsp.fecha === fecha) {
        // Misma fecha ⇒ REABRIR la inspección del día (una por unidad/día):
        // se edita la misma cabecera, sin duplicar ni clonar.
        await inspeccionRepo.actualizarCabecera(ultimaInsp.cabeceraId, kmActual, fotoUnidad);
        cabeceraId = ultimaInsp.cabeceraId;
      } else {
        // Fecha nueva ⇒ inspección nueva precargada desde la anterior.
        const cab = await inspeccionRepo.crearCabecera(empresaId, match.numero, fecha, kmActual, fotoUnidad);
        if (ultimaInsp) {
          await inspeccionRepo.clonarNeumaticos(ultimaInsp.cabeceraId, cab.id);
        }
        cabeceraId = cab.id;
      }

      setUnidad(match.numero, match.configuracion, match.tipo_vehiculo);
      setCabecera(cabeceraId);
      navigate(`/inspeccion/${cabeceraId}`);
    } catch (e) {
      console.error('handleContinue error:', e);
    }
  };

  const handleCreate = async () => {
    if (!noExiste || !empresaId) return;
    (document.activeElement as HTMLElement | null)?.blur();
    try {
      const configObj = configs.find(c => c.notacion === config);
      const tipoVehiculo = configObj?.tipo_vehiculo ?? 'BUS';
      await unidadRepo.upsert({
        numero: q,
        empresa_id: empresaId,
        tipo_vehiculo: tipoVehiculo,
        configuracion: config,
        odometro_ultimo: kmActual,
        ultima_fecha: localDate(),
      });
      const fecha = localDate();
      const cab = await inspeccionRepo.crearCabecera(empresaId, q, fecha, kmActual, fotoUnidad);
      setUnidad(q, config, tipoVehiculo);
      setCabecera(cab.id);
      navigate(`/inspeccion/${cab.id}`);
    } catch (e) {
      console.error('handleCreate error:', e);
    }
  };

  const handleFoto = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const photo = await Camera.getPhoto({
          quality: 80,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Camera,
        });
        if (photo.dataUrl) setFotoUnidad(photo.dataUrl);
      } catch {
        // usuario canceló
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const onFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setFotoUnidad(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleBack = () => {
    clearUnidad();
    navigate('/empresa');
  };

  const selectStyle = (filled: boolean) => ({
    width: '100%' as const,
    border: `2px solid ${filled ? ORANGE : BORDER_DARK}`,
    borderRadius: 12,
    padding: '12px 14px',
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: 14,
    cursor: 'pointer' as const,
    fontFamily: MONO,
    textAlign: 'left' as const,
    minHeight: 56,
    background: filled ? 'rgba(240,104,34,0.15)' : FIELD_DARK,
  });

  return (
    <div className="screen-enter" style={{ height: '100%', background: SCREEN_DARK, display: 'flex', flexDirection: 'column', fontFamily: MONO, overflow: 'clip' }}>

      <div style={{ flexShrink: 0 }}>
        <div style={{ background: NAVY, padding: 'calc(16px + env(safe-area-inset-top, 0px)) 20px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={handleBack} aria-label="Volver" className="pressable" style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.9)', cursor: 'pointer', minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M13 4l-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: BEBAS, fontSize: 34, color: '#fff', letterSpacing: '0.06em', lineHeight: 1 }}>RENOVA</div>
            <div style={{ fontFamily: BEBAS, fontSize: 19, color: LABEL_BLUE, letterSpacing: '0.1em', lineHeight: 1, marginTop: -4 }}>INSPECTOR</div>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>{empresa?.nombre ?? ''}</div>
        </div>
        <div className="hazard-edge" />
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '24px 24px calc(20px + env(safe-area-inset-bottom, 0px))', display: 'flex', flexDirection: 'column' }}>

        <div style={{ fontSize: 11, fontWeight: 800, color: LABEL_BLUE, letterSpacing: '0.14em', marginBottom: 10, flexShrink: 0 }}>UNIDAD</div>

        <div style={{ border: `2px solid ${focusedField === 'search' ? ORANGE : BORDER_DARK}`, borderRadius: 14, display: 'flex', alignItems: 'center', padding: '0 16px', background: FIELD_DARK, transition: 'border-color 0.15s', flexShrink: 0, position: 'relative' }}>
          <SearchIcon active={!!match} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => handleSearch(e.target.value)}
            onFocus={() => { setFocusedField('search'); if (q.length >= 1) setShowSugerencias(true); }}
            onBlur={() => { setFocusedField(null); setTimeout(() => setShowSugerencias(false), 150); }}
            autoCapitalize="characters"
            autoCorrect="off"
            placeholder="N.º de unidad"
            className="dark-input"
            style={{ flex: 1, border: 'none', outline: 'none', padding: '16px 0', fontSize: 20, fontWeight: 800, color: VALUE_COLOR, background: 'transparent', fontFamily: MONO, letterSpacing: '0.04em' }}
          />
          {query && (
            <button onClick={reset} aria-label="Borrar" style={{ background: 'none', border: 'none', color: LABEL_BLUE, fontSize: 16, cursor: 'pointer', minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          )}
          {showSugerencias && sugerencias.length > 0 && (
            <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: -2, right: -2, background: FIELD_DARK, border: `2px solid ${BORDER_DARK}`, borderRadius: 12, overflow: 'hidden', zIndex: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
              {sugerencias.map(u => (
                <button
                  key={u.numero}
                  onMouseDown={e => { e.preventDefault(); selectUnidad(u); setShowSugerencias(false); }}
                  style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: `1px solid ${BORDER_DARK}`, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', fontFamily: MONO, textAlign: 'left', minHeight: 52 }}
                >
                  <span style={{ fontWeight: 800, fontSize: 16, color: VALUE_COLOR }}>{u.numero}</span>
                  <span style={{ fontSize: 12, color: LABEL_BLUE }}>{u.configuracion}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {!showResult && recientes.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: LABEL_BLUE, letterSpacing: '0.14em', marginBottom: 10 }}>HOY — {recientes.length} unidad{recientes.length !== 1 ? 'es' : ''}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recientes.map(u => (
                <button
                  key={u.numero}
                  onClick={() => selectUnidad(u)}
                  className="pressable"
                  style={{ width: '100%', background: FIELD_DARK, border: `2px solid ${BORDER_DARK}`, borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', fontFamily: MONO, textAlign: 'left' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 18, color: VALUE_COLOR, letterSpacing: '0.04em' }}>{u.numero}</div>
                    <div style={{ fontSize: 11, color: LABEL_BLUE, marginTop: 2 }}>{u.configuracion} · {u.ultima_fecha ? fmtFecha(u.ultima_fecha) : ''}</div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
                    <path d="M6 3l5 5-5 5" stroke={BORDER_DARK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              ))}
            </div>
          </div>
        )}

        {!showResult && recientes.length === 0 && (
          <div style={{ marginTop: 60, textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: LABEL_BLUE, lineHeight: 1.7 }}>
              Ingresa el número de la unidad<br />para continuar.
            </div>
          </div>
        )}

        {match && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 20 }}>
            <div style={{ background: NAVY, borderRadius: 16, padding: '20px 22px', flexShrink: 0 }}>
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', marginBottom: 8 }}>ÚLTIMA INSPECCIÓN</div>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: 24, lineHeight: 1.1, letterSpacing: '-0.01em' }}>
                {ultimaInsp ? fmtFecha(ultimaInsp.fecha) : 'Sin inspecciones previas'}
              </div>
              {ultimaInsp && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em' }}>ODÓMETRO</span>
                  <span style={{ color: YELLOW, fontWeight: 800, fontSize: 14 }}>{fmtKm(ultimaInsp.odometro)}</span>
                </div>
              )}
            </div>

            <div style={{ flexShrink: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: LABEL_BLUE, letterSpacing: '0.14em', marginBottom: 8 }}>ODÓMETRO ACTUAL</div>
              <div style={{ border: `2px solid ${focusedField === 'odometro' ? ORANGE : BORDER_DARK}`, borderRadius: 14, display: 'flex', alignItems: 'center', padding: '0 16px', background: FIELD_DARK, transition: 'border-color 0.15s' }}>
                <input
                  value={odometro}
                  onChange={e => setOdometro(e.target.value.replace(/[^0-9]/g, ''))}
                  onFocus={() => setFocusedField('odometro')}
                  onBlur={() => setFocusedField(null)}
                  inputMode="numeric"
                  placeholder="0"
                  autoFocus
                  className="dark-input"
                  style={{ flex: 1, border: 'none', outline: 'none', padding: '14px 0', fontSize: 24, fontWeight: 800, color: VALUE_COLOR, background: 'transparent', fontFamily: MONO, letterSpacing: '0.04em', fontVariantNumeric: 'tabular-nums' as const }}
                />
                <span style={{ color: LABEL_BLUE, fontSize: 13, fontWeight: 700, flexShrink: 0 }}>km</span>
              </div>
              {kmBajo && (
                <div style={{ fontSize: 11, color: ORANGE, fontWeight: 700, marginTop: 7, paddingLeft: 4 }}>
                  ⚠ Menor al anterior ({fmtKm(kmPrev)})
                </div>
              )}
            </div>

            <button onClick={handleFoto} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: `2px dashed ${BORDER_DARK}`, borderRadius: 12, padding: '12px', background: FIELD_DARK, cursor: 'pointer', fontFamily: MONO, flexShrink: 0, transition: 'border-color 0.15s' }}>
              {fotoUnidad ? (
                <img src={fotoUnidad} alt="Foto unidad" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />
              ) : (
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true"><path d="M8 4l1.5-2h3L14 4h4a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1h4z" stroke={LABEL_BLUE} strokeWidth="1.8" strokeLinejoin="round"/><circle cx="11" cy="11" r="3" stroke={LABEL_BLUE} strokeWidth="1.8"/></svg>
              )}
              <span style={{ fontSize: 12, fontWeight: 700, color: fotoUnidad ? VALUE_COLOR : LABEL_BLUE }}>{fotoUnidad ? 'Cambiar foto' : 'Tomar foto'}</span>
            </button>
          </div>
        )}

        {noExiste && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 20 }}>
            <div style={{ border: `2px dashed ${ORANGE}`, borderRadius: 16, padding: '16px 20px', display: 'flex', gap: 14, alignItems: 'center', flexShrink: 0 }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 800, fontSize: 24, color: '#fff', lineHeight: 1 }}>+</div>
              <div>
                <div style={{ color: ORANGE, fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', marginBottom: 3 }}>UNIDAD NUEVA</div>
                <div style={{ color: VALUE_COLOR, fontWeight: 800, fontSize: 15 }}>Unidad {q}</div>
              </div>
            </div>

            <div style={{ flexShrink: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: LABEL_BLUE, letterSpacing: '0.14em', marginBottom: 8 }}>ODÓMETRO INICIAL</div>
              <div style={{ border: `2px solid ${focusedField === 'odometro' ? ORANGE : BORDER_DARK}`, borderRadius: 14, display: 'flex', alignItems: 'center', padding: '0 16px', background: FIELD_DARK, transition: 'border-color 0.15s' }}>
                <input
                  value={odometro}
                  onChange={e => setOdometro(e.target.value.replace(/[^0-9]/g, ''))}
                  onFocus={() => setFocusedField('odometro')}
                  onBlur={() => setFocusedField(null)}
                  inputMode="numeric"
                  placeholder="0"
                  className="dark-input"
                  style={{ flex: 1, border: 'none', outline: 'none', padding: '14px 0', fontSize: 24, fontWeight: 800, color: VALUE_COLOR, background: 'transparent', fontFamily: MONO, letterSpacing: '0.04em', fontVariantNumeric: 'tabular-nums' as const }}
                />
                <span style={{ color: LABEL_BLUE, fontSize: 13, fontWeight: 700, flexShrink: 0 }}>km</span>
              </div>
            </div>

            <button onClick={handleFoto} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: `2px dashed ${BORDER_DARK}`, borderRadius: 12, padding: '12px', background: FIELD_DARK, cursor: 'pointer', fontFamily: MONO, flexShrink: 0, transition: 'border-color 0.15s' }}>
              {fotoUnidad ? (
                <img src={fotoUnidad} alt="Foto unidad" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />
              ) : (
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true"><path d="M8 4l1.5-2h3L14 4h4a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1h4z" stroke={LABEL_BLUE} strokeWidth="1.8" strokeLinejoin="round"/><circle cx="11" cy="11" r="3" stroke={LABEL_BLUE} strokeWidth="1.8"/></svg>
              )}
              <span style={{ fontSize: 12, fontWeight: 700, color: fotoUnidad ? VALUE_COLOR : LABEL_BLUE }}>{fotoUnidad ? 'Cambiar foto' : 'Tomar foto'}</span>
            </button>

            <div style={{ flexShrink: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: LABEL_BLUE, letterSpacing: '0.14em', marginBottom: 8 }}>CONFIGURACIÓN DEL VEHÍCULO</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(() => {
                  const unique = new Map<string, { notacion: string; count: number; tipoVehiculo: string }>();
                  for (const c of configs) {
                    if (!unique.has(c.notacion)) {
                      unique.set(c.notacion, { notacion: c.notacion, count: 0, tipoVehiculo: c.tipo_vehiculo });
                    }
                    unique.get(c.notacion)!.count++;
                  }
                  return Array.from(unique.values());
                })().map(c => {
                  const sel = config === c.notacion;
                  return (
                    <button
                      key={c.notacion}
                      onClick={() => setConfig(c.notacion)}
                      style={{ ...selectStyle(sel) }}
                    >
                      <span style={{ fontSize: 18, fontWeight: 900, color: sel ? ORANGE : VALUE_COLOR, letterSpacing: '0.04em', flexShrink: 0, width: 64 }}>{c.notacion}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, fontSize: 13, color: VALUE_COLOR }}>{c.count} llantas</div>
                        <div style={{ fontSize: 11, color: LABEL_BLUE, marginTop: 2 }}>{c.tipoVehiculo}</div>
                      </div>
                      {sel && <span style={{ color: ORANGE, fontWeight: 800, fontSize: 16, flexShrink: 0 }}>✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {showResult && (
          <button
            disabled={!canContinue && !canCreate}
            onClick={canContinue ? handleContinue : handleCreate}
            className="pressable chamfer"
            style={{
              background: canContinue ? ORANGE : canCreate ? NAVY : FIELD_DARK,
              color: (canContinue || canCreate) ? '#fff' : BORDER_DARK,
              border: 'none',
              padding: '17px',
              fontWeight: 800,
              fontSize: 15,
              letterSpacing: '0.04em',
              cursor: (canContinue || canCreate) ? 'pointer' : 'default',
              fontFamily: MONO,
              marginTop: 16,
              flexShrink: 0,
              transition: 'background 0.15s',
            }}
          >
            {noExiste ? 'CREAR UNIDAD' : ultimaInsp?.fecha === localDate() ? 'REABRIR INSPECCIÓN DE HOY' : 'CONTINUAR INSPECCIÓN'}
          </button>
        )}
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={onFotoChange} style={{ display: 'none' }} />
    </div>
  );
}
