import { useState } from 'react';
import Brand from './components/Brand';
import type { MovementOrder } from './lib/types';
import ExecutionScreen from './screens/ExecutionScreen';
import LoginScreen from './screens/LoginScreen';
import OrdersScreen from './screens/OrdersScreen';
import { AuthProvider } from './state/AuthContext';
import { useAuth } from './state/useAuth';

function LoadingScreen() {
  return (
    <main className="loading-screen">
      <Brand />
      <div className="hazard-edge" />
      <span>CARGANDO TURNO…</span>
    </main>
  );
}

function GuardedApp() {
  const { ready, session, profile, error, signOut, retryProfile } = useAuth();
  const [selectedOrder, setSelectedOrder] = useState<MovementOrder | null>(null);
  const [ordersRevision, setOrdersRevision] = useState(0);

  if (!ready) return <LoadingScreen />;
  if (!session) return <LoginScreen />;
  if (!profile) {
    return (
      <main className="blocked-screen">
        <Brand />
        <div className="error-box">{error ?? 'Tu cuenta no tiene un perfil RENOVA activo.'}</div>
        <button className="primary-button" type="button" onClick={() => void retryProfile()}>REINTENTAR</button>
        <button className="text-button" type="button" onClick={() => void signOut()}>CERRAR SESIÓN</button>
      </main>
    );
  }
  if (!profile.active || profile.role !== 'operator') {
    return (
      <main className="blocked-screen">
        <Brand />
        <div className="section-kicker">ACCESO RESTRINGIDO</div>
        <h1>ESTA APP ES PARA OPERARIOS</h1>
        <p>Tu rol actual es <strong>{profile.role}</strong>. Inspectores y supervisores usan sus propios flujos.</p>
        <button className="text-button" type="button" onClick={() => void signOut()}>CERRAR SESIÓN</button>
      </main>
    );
  }

  if (selectedOrder) {
    return (
      <ExecutionScreen
        order={selectedOrder}
        profile={profile}
        onSignOut={() => void signOut()}
        onBack={(completed) => {
          setSelectedOrder(null);
          if (completed) setOrdersRevision((value) => value + 1);
        }}
      />
    );
  }

  return (
    <OrdersScreen
      key={ordersRevision}
      profile={profile}
      onOpen={setSelectedOrder}
      onSignOut={() => void signOut()}
    />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <GuardedApp />
    </AuthProvider>
  );
}
