import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/context';
import { signInInspector } from '../auth/auth';
import { BEBAS, MONO, NAVY, ORANGE, SCREEN_DARK, FIELD_DARK, LABEL_BLUE, BORDER_DARK, VALUE_COLOR } from '../theme';

export default function LoginScreen() {
  const { profile } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (profile) {
    navigate('/unidad', { replace: true });
    return null;
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError(null);
    try {
      await signInInspector(email, password);
      navigate('/unidad', { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ height: '100%', background: SCREEN_DARK, display: 'flex', flexDirection: 'column', fontFamily: MONO }}>
      <div style={{ background: NAVY, padding: 'calc(28px + env(safe-area-inset-top, 0px)) 24px 24px' }}>
        <div style={{ fontFamily: BEBAS, fontSize: 44, color: '#fff', lineHeight: 1 }}>VULCAN</div>
        <div style={{ fontFamily: BEBAS, fontSize: 25, color: LABEL_BLUE, letterSpacing: '0.1em' }}>INSPECTOR</div>
      </div>
      <div className="hazard-edge" />
      <form onSubmit={submit} style={{ margin: 'auto 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ color: LABEL_BLUE, fontSize: 11, fontWeight: 800, letterSpacing: '0.14em' }}>ACCESO DEL INSPECTOR</div>
        <h1 style={{ color: VALUE_COLOR, fontSize: 25, margin: '0 0 12px' }}>Inicia sesión</h1>
        <label style={{ color: LABEL_BLUE, fontSize: 11, fontWeight: 800 }}>CORREO
          <input value={email} onChange={e => setEmail(e.target.value)} type="email" autoComplete="username" placeholder="tu correo" required style={{ display: 'block', width: '100%', marginTop: 7, padding: 15, background: FIELD_DARK, border: `2px solid ${BORDER_DARK}`, borderRadius: 12, color: VALUE_COLOR, font: `700 16px ${MONO}` }} />
        </label>
        <label style={{ color: LABEL_BLUE, fontSize: 11, fontWeight: 800 }}>CONTRASEÑA
          <input value={password} onChange={e => setPassword(e.target.value)} type="password" autoComplete="current-password" placeholder="Contraseña" required style={{ display: 'block', width: '100%', marginTop: 7, padding: 15, background: FIELD_DARK, border: `2px solid ${BORDER_DARK}`, borderRadius: 12, color: VALUE_COLOR, font: `700 16px ${MONO}` }} />
        </label>
        {error ? <div role="alert" style={{ color: '#ff9d78', fontSize: 12, lineHeight: 1.5 }}>{error}</div> : null}
        <button type="submit" disabled={loading} className="pressable chamfer" style={{ marginTop: 8, padding: 17, border: 0, background: loading ? BORDER_DARK : ORANGE, color: loading ? '#4f687c' : NAVY, font: `800 14px ${MONO}` }}>
          {loading ? 'VALIDANDO…' : 'INGRESAR →'}
        </button>
      </form>
      <div style={{ color: LABEL_BLUE, fontSize: 10, textAlign: 'center', padding: '24px 24px calc(24px + env(safe-area-inset-bottom, 0px))' }}>Solo verás las unidades de tu empresa.</div>
    </div>
  );
}
