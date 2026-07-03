import { createContext } from 'react';
import type { Empresa } from '../db/schema';

export interface AppState {
  initialized: boolean;
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
}

export const AppContext = createContext<AppCtx | null>(null);
