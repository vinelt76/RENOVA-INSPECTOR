import { useCallback, useEffect, useMemo, useState } from 'react';
import AppHeader from '../components/AppHeader';
import MovementCard from '../components/MovementCard';
import { draftFromOrder, draftStorageKey, validateDraft } from '../lib/model';
import { claimMovementOrder, completeMovementOrder } from '../lib/supabase';
import type { ExecutionItem, MovementDraft, MovementOrder, OperatorProfile } from '../lib/types';

interface Props {
  order: MovementOrder;
  profile: OperatorProfile;
  onBack: (completed?: boolean) => void;
  onSignOut: () => void;
}

function loadDraft(key: string, order: MovementOrder): MovementDraft {
  try {
    const stored = JSON.parse(localStorage.getItem(key) ?? 'null') as MovementDraft | null;
    if (stored?.version === 1 && stored.orderId === order.id) return stored;
  } catch {
    // Un borrador corrupto no impide ejecutar la orden.
  }
  return draftFromOrder(order);
}

export default function ExecutionScreen({ order, profile, onBack, onSignOut }: Props) {
  const storageKey = draftStorageKey(profile.id, profile.company_id, order.id);
  const [draft, setDraft] = useState<MovementDraft>(() => loadDraft(storageKey, order));
  const [claiming, setClaiming] = useState(order.status === 'issued');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [complete, setComplete] = useState(order.status === 'completed');
  const errors = useMemo(() => validateDraft(draft, order.last_odometer), [draft, order.last_odometer]);

  useEffect(() => {
    if (order.status !== 'issued') return;
    void claimMovementOrder(order.id)
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'No se pudo tomar la orden.'))
      .finally(() => setClaiming(false));
  }, [order.id, order.status]);

  useEffect(() => {
    if (complete) return;
    const timer = window.setTimeout(() => {
      localStorage.setItem(storageKey, JSON.stringify({ ...draft, updatedAt: new Date().toISOString() }));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [complete, draft, storageKey]);

  const updateItem = useCallback((index: number, patch: Partial<ExecutionItem>) => {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
    }));
  }, []);

  const submit = async () => {
    setShowErrors(true);
    if (errors.length > 0 || claiming) return;
    setSubmitting(true);
    setError(null);
    try {
      await completeMovementOrder(draft);
      localStorage.removeItem(storageKey);
      setComplete(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo completar la orden. El borrador sigue guardado.');
    } finally {
      setSubmitting(false);
    }
  };

  if (complete) {
    return (
      <div className="app-shell">
        <AppHeader company={profile.company_name} operator={profile.full_name} onSignOut={onSignOut} onBack={() => onBack(true)} />
        <main className="success-screen screen-enter">
          <div className="success-mark">✓</div>
          <div className="section-kicker">ORDEN REGISTRADA</div>
          <h1>BUS {order.plate}</h1>
          <p>{draft.items.length} movimientos quedaron guardados con trazabilidad del operario.</p>
          <div className="success-summary">
            <span>KILOMETRAJE</span>
            <strong>{Number(draft.odometer || order.odometer_km || 0).toLocaleString('es-PE')} KM</strong>
          </div>
          <button className="secondary-button" type="button" onClick={() => onBack(true)}>VOLVER A ÓRDENES →</button>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <AppHeader company={profile.company_name} operator={profile.full_name} onSignOut={onSignOut} onBack={() => onBack()} />
      <main className="execution-content screen-enter">
        <section className="job-header">
          <div>
            <div className="section-kicker">ORDEN DE MOVIMIENTO</div>
            <h1>BUS {order.plate}</h1>
            <p>CONFIG. {order.vehicle_config} · {order.requested_items_count} MOVIMIENTOS</p>
          </div>
          <span className="status-chip status-chip--in_progress">{claiming ? 'TOMANDO…' : 'EN CURSO'}</span>
        </section>

        {order.instructions ? (
          <section className="instruction-box">
            <span>INDICACIÓN DEL SUPERVISOR</span>
            <p>{order.instructions}</p>
            <small>{order.requested_by_name}</small>
          </section>
        ) : null}

        <section className="odometer-panel">
          <div>
            <span>KILOMETRAJE DE LA MÁQUINA</span>
            <small>UNA SOLA LECTURA PARA TODA LA ORDEN</small>
          </div>
          <label>
            <input
              type="number"
              inputMode="numeric"
              min={order.last_odometer ?? 0}
              value={draft.odometer}
              onChange={(event) => setDraft((current) => ({ ...current, odometer: event.target.value }))}
              placeholder="000000"
            />
            <b>KM</b>
          </label>
          {order.last_odometer !== null ? <small>ÚLTIMO CONOCIDO: {order.last_odometer.toLocaleString('es-PE')} KM</small> : null}
        </section>

        <section className="movement-list">
          {draft.items.map((item, index) => (
            <MovementCard key={item.id} index={index} item={item} onChange={updateItem} />
          ))}
        </section>

        {showErrors && errors.length > 0 ? (
          <div className="error-box" role="alert">
            <strong>REVISA ESTOS DATOS</strong>
            <ul>{errors.map((message) => <li key={message}>{message}</li>)}</ul>
          </div>
        ) : null}
        {error ? <div className="error-box" role="alert">{error}</div> : null}

        <section className="submit-panel">
          <div>
            <span>BORRADOR GUARDADO EN ESTE EQUIPO</span>
            <small>Si falla la señal, no pierdes lo escrito.</small>
          </div>
          <button className="primary-button" type="button" onClick={() => void submit()} disabled={submitting || claiming}>
            {submitting ? 'ENVIANDO…' : 'COMPLETAR ORDEN →'}
          </button>
        </section>
      </main>
    </div>
  );
}
