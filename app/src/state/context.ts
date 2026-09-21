import { createContext, useContext } from 'react';
import type { Empresa } from '../db/schema';
import type { InspectorProfile } from '../auth/auth';

export interface AppState {
  initialized: boolean;
  profile: InspectorProfile | null;
  empresaId: string | null;
  empresa: Empresa | null;
  unidadNumero: string | null;
  unidadConfig: string | null;
  unidadTipoVehiculo: string | null;
  cabeceraId: string | null;
}

export interface AppCtx extends AppState {
  setEmpresa: (id: string) => Promise<void>;
  setUnidad: (numero: string, config: string, tipoVehiculo: string) => void;
  setCabecera: (id: string) => void;
  clearUnidad: () => void;
  signOut: () => Promise<void>;
}

export const AppContext = createContext<AppCtx | null>(null);
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
