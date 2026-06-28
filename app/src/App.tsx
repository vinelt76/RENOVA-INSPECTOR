import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './state/AppContext';
import EmpresaScreen from './screens/EmpresaScreen';
import UnidadScreen from './screens/UnidadScreen';
import InspeccionScreen from './screens/InspeccionScreen';
import './index.css';

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#cbd5e1', fontFamily: '"JetBrains Mono", monospace' }}>
      <div style={{ color: '#7b879c', fontSize: 14 }}>Cargando…</div>
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
  return (
    <BrowserRouter>
      <AppProvider>
        <AppRoutes />
      </AppProvider>
    </BrowserRouter>
  );
}
