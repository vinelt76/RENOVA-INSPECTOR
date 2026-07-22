import { useState, type FormEvent } from 'react';
import Brand from '../components/Brand';
import { useAuth } from '../state/useAuth';

export default function LoginScreen() {
  const { signIn, error: setupError } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!identifier.trim() || !password) return;
    setSubmitting(true);
    setError(null);
    try {
      await signIn(identifier, password);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo iniciar sesión.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-screen screen-enter">
      <div className="login-brand">
        <Brand />
        <div className="hazard-edge" />
        <p>CAPTURA DE TALLER</p>
      </div>

      <form className="login-form" onSubmit={submit}>
        <div className="section-kicker">ACCESO DE OPERARIO</div>
        <h1>INICIAR TURNO</h1>
        <p>Tu cuenta abre solamente las órdenes de la empresa que tienes asignada.</p>

        <label className="field field--full">
          <span>USUARIO</span>
          <input
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            placeholder="USUARIO"
          />
        </label>
        <label className="field field--full">
          <span>CONTRASEÑA</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            placeholder="••••••••"
          />
        </label>

        {(error ?? setupError) ? <div className="error-box" role="alert">{error ?? setupError}</div> : null}

        <button className="primary-button" type="submit" disabled={submitting || !identifier.trim() || !password}>
          {submitting ? 'VERIFICANDO…' : 'ENTRAR →'}
        </button>
      </form>
      <footer className="login-footer">RENOVA · OPERACIÓN CONTROLADA POR EMPRESA</footer>
    </main>
  );
}
