import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './state/AppContext';
import { useApp } from './state/useApp';
import EmpresaScreen from './screens/EmpresaScreen';
import UnidadScreen from './screens/UnidadScreen';
import InspeccionScreen from './screens/InspeccionScreen';
import './index.css';

function LoadingScreen() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, background: '#07111C', fontFamily: '"JetBrains Mono", monospace' }}>
      <div style={{ lineHeight: 1, textAlign: 'center' }}>
        <div style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 42, color: '#fff', letterSpacing: '0.06em' }}>RENOVA</div>
        <div style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 24, color: '#7AABCC', letterSpacing: '0.1em', marginTop: -6 }}>INSPECTOR</div>
      </div>
      <div className="hazard-edge" style={{ width: 96 }} />
      <div style={{ color: '#7AABCC', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em' }}>CARGANDO…</div>
    </div>
  );
}

function AppRoutes() {
  const { initialized, empresaId } = useApp();

  if (!initialized) return <LoadingScreen />;

  return (
    <Routes>
      <Route path="/empresa" element={<EmpresaScreen />} />
      <Route path="/unidad" element={empresaId ? <UnidadScreen /> : <Navigate to="/empresa" replace />} />
      <Route path="/inspeccion/:cabeceraId" element={empresaId ? <InspeccionScreen /> : <Navigate to="/empresa" replace />} />
      <Route path="/grilla/:cabeceraId" element={<Navigate to="/inspeccion" replace />} />
      <Route path="*" element={<Navigate to={empresaId ? '/unidad' : '/empresa'} replace />} />
    </Routes>
  );
}

export default function App() {
  const Router = import.meta.env.BASE_URL === '/' ? BrowserRouter : HashRouter;

  return (
    <Router>
      <AppProvider>
        <AppRoutes />
      </AppProvider>
    </Router>
  );
}
