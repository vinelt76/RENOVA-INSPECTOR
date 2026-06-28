import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { empresaRepo } from '../db/repos/empresaRepo';
import { initApp } from '../db/sqlite';
import type { Empresa } from '../db/schema';

interface AppState {
  initialized: boolean;
  empresaId: string | null;
  empresa: Empresa | null;
  unidadNumero: string | null;
  unidadConfig: string | null;
  unidadTipoVehiculo: string | null;
  cabeceraId: string | null;
}

interface AppCtx extends AppState {
  setEmpresa: (id: string) => Promise<void>;
  setUnidad: (numero: string, config: string, tipoVehiculo: string) => void;
  setCabecera: (id: string) => void;
  clearUnidad: () => void;
}

const AppContext = createContext<AppCtx | null>(null);

const EMPRESA_KEY = 'renova_empresa_id';

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({
    initialized: false,
    empresaId: null,
    empresa: null,
    unidadNumero: null,
    unidadConfig: null,
    unidadTipoVehiculo: null,
    cabeceraId: null,
  });

  useEffect(() => {
    (async () => {
      try {
        await initApp();
      } catch (e) {
        console.error('DB init error:', e);
      }
      const saved = localStorage.getItem(EMPRESA_KEY);
      if (saved) {
        const emp = await empresaRepo.getById(saved);
        setState(s => ({ ...s, initialized: true, empresaId: saved, empresa: emp }));
      } else {
        setState(s => ({ ...s, initialized: true }));
      }
    })();
  }, []);

  const setEmpresa = useCallback(async (id: string) => {
    localStorage.setItem(EMPRESA_KEY, id);
    const emp = await empresaRepo.getById(id);
    setState(s => ({ ...s, empresaId: id, empresa: emp, unidadNumero: null, unidadConfig: null, cabeceraId: null }));
  }, []);

  const setUnidad = useCallback((numero: string, config: string, tipoVehiculo: string) => {
    setState(s => ({ ...s, unidadNumero: numero, unidadConfig: config, unidadTipoVehiculo: tipoVehiculo }));
  }, []);

  const setCabecera = useCallback((id: string) => {
    setState(s => ({ ...s, cabeceraId: id }));
  }, []);

  const clearUnidad = useCallback(() => {
    setState(s => ({ ...s, unidadNumero: null, unidadConfig: null, unidadTipoVehiculo: null, cabeceraId: null }));
  }, []);

  return (
    <AppContext.Provider value={{ ...state, setEmpresa, setUnidad, setCabecera, clearUnidad }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
