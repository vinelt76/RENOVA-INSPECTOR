import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { empresaRepo } from '../db/repos/empresaRepo';
import { useApp } from '../state/useApp';
import { BEBAS, MONO, NAVY, ORANGE, YELLOW, SCREEN_DARK, FIELD_DARK, LABEL_BLUE, BORDER_DARK, VALUE_COLOR } from '../theme';
import type { Empresa } from '../db/schema';

function iniciales(nombre: string) {
  const limpio = nombre.replace(/[^A-Za-zÁÉÍÓÚÑ ]/g, '').trim();
  const partes = limpio.split(' ').filter(Boolean);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

function fechaHoy() {
  const d = new Date();
  const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${dias[d.getDay()]} ${d.getDate()} ${meses[d.getMonth()]} ${d.getFullYear()}`;
}

export default function EmpresaScreen() {
  const { setEmpresa } = useApp();
  const navigate = useNavigate();
  const [sel, setSel] = useState<string | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);

  useEffect(() => {
    empresaRepo.listAll().then(rows => setEmpresas(rows.filter(e => e.id === 'movil')));
  }, []);

  const handleComenzar = async () => {
    if (!sel) return;
    await setEmpresa(sel);
    navigate('/unidad');
  };

  return (
    <div className="screen-enter" style={{ height: '100%', background: SCREEN_DARK, display: 'flex', flexDirection: 'column', fontFamily: MONO, overflow: 'clip' }}>

      {/* Header */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ background: NAVY, padding: 'calc(20px + env(safe-area-inset-top, 0px)) 24px 20px' }}>
          <div style={{ lineHeight: 1 }}>
            <div style={{ fontFamily: BEBAS, fontSize: 42, color: '#fff', letterSpacing: '0.06em' }}>RENOVA</div>
            <div style={{ fontFamily: BEBAS, fontSize: 24, color: LABEL_BLUE, letterSpacing: '0.1em', marginTop: -6 }}>INSPECTOR</div>
          </div>
        </div>
        <div className="hazard-edge" />
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '24px 24px calc(24px + env(safe-area-inset-bottom, 0px))', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Card fecha */}
        <div style={{ background: YELLOW, borderRadius: 18, padding: '20px 22px', flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: NAVY, letterSpacing: '0.12em', opacity: 0.6, marginBottom: 4 }}>HOY</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: NAVY, marginBottom: 12 }}>{fechaHoy()}</div>
          <div style={{ height: 1, background: 'rgba(21,35,63,0.15)', marginBottom: 14 }} />
          <div style={{ fontSize: 25, fontWeight: 800, color: NAVY, lineHeight: 1.2, letterSpacing: '-0.01em' }}>
            ¿A quién<br />inspeccionamos?
          </div>
        </div>

        {/* Lista de empresas — siempre visible */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
          {empresas.map(e => {
            const activa = e.id === sel;
            return (
              <button
                key={e.id}
                onClick={() => setSel(activa ? null : e.id)}
                className="pressable"
                style={{
                  width: '100%',
                  background: activa ? 'rgba(240,104,34,0.12)' : FIELD_DARK,
                  border: `2px solid ${activa ? ORANGE : BORDER_DARK}`,
                  borderRadius: 14,
                  padding: '14px 18px',
                  display: 'flex', alignItems: 'center', gap: 14,
                  cursor: 'pointer', fontFamily: MONO, textAlign: 'left',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: activa ? ORANGE : NAVY,
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: 13,
                  transition: 'background 0.15s',
                }}>
                  {iniciales(e.nombre)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: VALUE_COLOR, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.nombre}</div>
                  <div style={{ fontSize: 12, color: LABEL_BLUE, marginTop: 2 }}>{e.flota ?? ''}</div>
                </div>
                {activa && <span style={{ color: ORANGE, fontWeight: 800, fontSize: 18, flexShrink: 0 }}>✓</span>}
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1 }} />

        {/* CTA */}
        <button
          disabled={!sel}
          onClick={handleComenzar}
          className="pressable chamfer"
          style={{
            background: sel ? ORANGE : FIELD_DARK,
            color: sel ? '#fff' : BORDER_DARK,
            border: 'none', padding: '17px',
            fontWeight: 800, fontSize: 15, letterSpacing: '0.04em',
            cursor: sel ? 'pointer' : 'default', fontFamily: MONO,
            transition: 'background 0.2s, color 0.2s', flexShrink: 0,
          }}
        >
          COMENZAR INSPECCIÓN
        </button>
      </div>
    </div>
  );
}
