import { useCallback, useEffect, useState } from 'react';
import AppHeader from '../components/AppHeader';
import { loadMovementOrders } from '../lib/supabase';
import type { MovementOrder, OperatorProfile } from '../lib/types';

interface Props {
  profile: OperatorProfile;
  onOpen: (order: MovementOrder) => void;
  onSignOut: () => void;
}

function fmtDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('es-PE', {
    weekday: 'short', day: '2-digit', month: 'short',
  }).toUpperCase();
}

function statusLabel(status: MovementOrder['status']) {
  if (status === 'in_progress') return 'EN CURSO';
  if (status === 'completed') return 'COMPLETADA';
  return 'PENDIENTE';
}

export default function OrdersScreen({ profile, onOpen, onSignOut }: Props) {
  const [orders, setOrders] = useState<MovementOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheKey = `renova:movements:orders:v1:${profile.id}:${profile.company_id}`;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fresh = await loadMovementOrders();
      setOrders(fresh);
      localStorage.setItem(cacheKey, JSON.stringify(fresh));
      setOffline(false);
    } catch (cause) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setOrders(JSON.parse(cached) as MovementOrder[]);
        setOffline(true);
      } else {
        setError(cause instanceof Error ? cause.message : 'No se pudieron cargar las órdenes.');
      }
    } finally {
      setLoading(false);
    }
  }, [cacheKey]);

  useEffect(() => { void refresh(); }, [refresh]);

  const active = orders.filter((order) => order.status !== 'completed');
  const completed = orders.filter((order) => order.status === 'completed').slice(0, 10);

  return (
    <div className="app-shell screen-enter">
      <AppHeader company={profile.company_name} operator={profile.full_name} onSignOut={onSignOut} />
      <main className="orders-content">
        <section className="orders-heading">
          <div>
            <div className="section-kicker">TRABAJO ASIGNADO</div>
            <h1>ÓRDENES DE MOVIMIENTO</h1>
          </div>
          <button className="refresh-button" type="button" onClick={() => void refresh()} disabled={loading}>
            ↻
          </button>
        </section>

        {offline ? <div className="offline-banner">● SIN CONEXIÓN · MOSTRANDO ÚLTIMA LISTA GUARDADA</div> : null}
        {error ? <div className="error-box" role="alert">{error}</div> : null}
        {loading && orders.length === 0 ? <div className="loading-block">CARGANDO ÓRDENES…</div> : null}

        <section className="orders-list" aria-label="Órdenes pendientes">
          {active.map((order) => (
            <button className="order-card" type="button" key={order.id} onClick={() => onOpen(order)}>
              <div className="order-card__top">
                <span className={`status-chip status-chip--${order.status}`}>{statusLabel(order.status)}</span>
                <span>{fmtDate(order.scheduled_for)}</span>
              </div>
              <div className="order-card__plate">BUS {order.plate}</div>
              <div className="order-card__meta">
                <span>{order.vehicle_config}</span>
                <span>{order.requested_items_count} MOV.</span>
                <span>SUP. {order.requested_by_name}</span>
              </div>
              {order.instructions ? <p>{order.instructions}</p> : null}
              <div className="order-card__action">{order.status === 'in_progress' ? 'CONTINUAR' : 'ABRIR ORDEN'} →</div>
            </button>
          ))}
          {!loading && active.length === 0 ? (
            <div className="empty-state">
              <span>✓</span>
              <strong>SIN ÓRDENES PENDIENTES</strong>
              <p>Las nuevas indicaciones del supervisor aparecerán aquí.</p>
            </div>
          ) : null}
        </section>

        {completed.length > 0 ? (
          <section className="completed-section">
            <h2>COMPLETADAS RECIENTEMENTE</h2>
            {completed.map((order) => (
              <button type="button" key={order.id} onClick={() => onOpen(order)}>
                <strong>BUS {order.plate}</strong>
                <span>{fmtDate(order.scheduled_for)} · {order.requested_items_count} MOV.</span>
                <b>✓</b>
              </button>
            ))}
          </section>
        ) : null}
      </main>
    </div>
  );
}
