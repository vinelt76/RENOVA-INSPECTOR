import { useCallback, useEffect, useMemo, useState } from 'react';
import AppHeader from '../components/AppHeader';
import ServiceCard from '../components/ServiceCard';
import {
  draftFromOrder,
  draftStorageKey,
  groupExecutionServices,
  prefillMovementItemsFromInspections,
  validateDraft,
} from '../lib/model';
import { claimMovementOrder, completeMovementOrder, loadLatestInspectionForPosition } from '../lib/supabase';
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
  const [started, setStarted] = useState(order.status !== 'issued');
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [prefilledPositions, setPrefilledPositions] = useState<Set<number>>(() => new Set());
  const [complete, setComplete] = useState(order.status === 'completed');
  const errors = useMemo(() => validateDraft(draft, order.last_odometer), [draft, order.last_odometer]);
  const services = useMemo(() => groupExecutionServices(draft.items), [draft.items]);
  const invalidPositions = useMemo(() => new Set(
    errors
      .map((message) => message.match(/^P(\d+):/)?.[1])
      .filter(Boolean)
      .map(Number),
  ), [errors]);
  const odometerInvalid = errors.some((message) =>
    message.startsWith('Ingresa el kilometraje') || message.startsWith('El kilometraje'),
  );

  const startOrder = async () => {
    setStarting(true);
    setError(null);
    try {
      await claimMovementOrder(order.id);
      setStarted(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo iniciar la orden.');
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    if (order.status === 'completed') return;
    let cancelled = false;
    const positions = [...new Set(draft.items.flatMap((item) => {
      if (item.direction === 'exit') return [item.position];
      if (item.origin_type === 'vehicle' && item.origin_position) return [item.origin_position];
      return [];
    }))];
    if (!positions.length) return;

    void Promise.all(positions.map(async (position) => {
      try {
        return [position, await loadLatestInspectionForPosition(order.unit_id, position)] as const;
      } catch {
        // La precarga es una ayuda. Si no hay red o la vista no está disponible,
        // el operario conserva la captura manual y puede completar la orden.
        return [position, null] as const;
      }
    })).then((entries) => {
      if (cancelled) return;
      const inspections = new Map(entries.filter(([, row]) => row).map(([position, row]) => [position, row!]));
      if (!inspections.size) return;
      setPrefilledPositions(new Set(inspections.keys()));
      setDraft((current) => ({
        ...current,
        items: prefillMovementItemsFromInspections(current.items, inspections),
      }));
    });

    return () => { cancelled = true; };
  }, [order.status, order.unit_id]);

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
    if (errors.length > 0 || !started || starting) {
      if (errors.length > 0) {
        window.setTimeout(() => {
          const firstInvalid = document.querySelector<HTMLInputElement>(
            '.odometer-panel--error input, .service-card--error input:not([type="checkbox"]), .service-card--error select',
          );
          firstInvalid?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          firstInvalid?.focus();
        }, 0);
      }
      return;
    }
    const confirmed = window.confirm(
      `¿Confirmar la orden del BUS ${order.plate}?\n\n${services.length} servicio${services.length === 1 ? '' : 's'} · ${Number(draft.odometer).toLocaleString('es-PE')} km\n\nEsta acción registrará la ejecución.`,
    );
    if (!confirmed) return;
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
          <p>{services.length} servicios quedaron guardados con salida, ingreso y trazabilidad del operario.</p>
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
            <p>CONFIG. {order.vehicle_config} · {services.length} SERVICIOS</p>
          </div>
          {order.status === 'issued' && !started ? (
            <span className="status-chip status-chip--issued">PENDIENTE DE INICIO</span>
          ) : (
            <span className="status-chip status-chip--in_progress">EN CURSO</span>
          )}
        </section>

        {order.instructions ? (
          <section className="instruction-box">
            <span>INDICACIÓN DEL SUPERVISOR</span>
            <p>{order.instructions}</p>
            <small>{order.requested_by_name}</small>
          </section>
        ) : null}

        <section className={`odometer-panel${showErrors && odometerInvalid ? ' odometer-panel--error' : ''}`}>
          <div>
          <span>KILOMETRAJE DE LA UNIDAD</span>
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

        <section className="service-list" aria-label="Servicios de la orden">
          {services.map((service) => (
            <ServiceCard
              key={service.position}
              service={service}
              invalid={showErrors && invalidPositions.has(service.position)}
              prefilled={prefilledPositions.has(service.position)}
              onChange={updateItem}
            />
          ))}
        </section>

        {showErrors && errors.length > 0 ? (
          <div className="error-box" role="alert">
            <strong>REVISA ESTOS DATOS</strong>
            <ul>{errors.map((message) => <li key={message}>{message}</li>)}</ul>
          </div>
        ) : null}
        {error ? (
          <div className="error-box" role="alert">
            <strong>NO SE PUDO COMPLETAR LA ORDEN</strong>
            <span>{error}</span>
            <button className="text-button error-box__action" type="button" onClick={() => onBack()}>
              VOLVER A ÓRDENES Y ACTUALIZAR
            </button>
          </div>
        ) : null}

        <section className="submit-panel">
          {!started ? (
          <div>
              <span>ORDEN LISTA PARA INICIAR</span>
              <small>Revisa la indicación y comienza cuando estés frente a la unidad.</small>
            </div>
          ) : (
            <div>
              <span>BORRADOR GUARDADO EN ESTE EQUIPO</span>
              <small>Si falla la señal, no pierdes lo escrito.</small>
            </div>
          )}
          <button className={started ? 'primary-button' : 'secondary-button'} type="button" onClick={() => void (started ? submit() : startOrder())} disabled={submitting || starting}>
            {starting ? 'INICIANDO…' : submitting ? 'ENVIANDO…' : started ? 'COMPLETAR ORDEN →' : 'INICIAR ORDEN →'}
          </button>
        </section>
      </main>
    </div>
  );
}
