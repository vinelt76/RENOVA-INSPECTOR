import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { empresaRepo } from '../db/repos/empresaRepo';
import { initApp } from '../db/sqlite';
import { pullEmpresas } from '../sync/pullEmpresas';
import { pullUmbrales } from '../sync/pullUmbrales';
import { drainSyncQueue } from '../sync/drainQueue';
import { AppContext, type AppState } from './context';
import { loadInspectorProfile, signOutInspector } from '../auth/auth';
import { supabase } from '../sync/supabaseClient';

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({
    initialized: false,
    profile: null,
    empresaId: null,
    empresa: null,
    unidadNumero: null,
    unidadConfig: null,
    unidadTipoVehiculo: null,
    cabeceraId: null,
  });

  useEffect(() => {
    let alive = true;

    const applySession = async (userId: string | null) => {
      if (!userId) {
        if (alive) setState(s => ({ ...s, initialized: true, profile: null, empresaId: null, empresa: null }));
        return;
      }
      try {
        const profile = await loadInspectorProfile(userId);
        await pullEmpresas();
        const empresas = await empresaRepo.listAll();
        const empresa = empresas.find(e => e.nombre.trim().toLowerCase() === profile.company.name.trim().toLowerCase());
        if (!empresa) throw new Error(`No se encontró localmente la empresa ${profile.company.name}.`);
        if (!alive) return;
        setState(s => ({ ...s, initialized: true, profile, empresaId: empresa.id, empresa }));
        pullUmbrales(empresa.id).catch(e => console.warn('pullUmbrales error:', e));
      } catch (e) {
        console.error('Auth/profile error:', e);
        if (alive) setState(s => ({ ...s, initialized: true, profile: null, empresaId: null, empresa: null }));
      }
    };

    (async () => {
      try {
        await initApp();
      } catch (e) {
        console.error('DB init error:', e);
      }
      if (!supabase) {
        setState(s => ({ ...s, initialized: true }));
        return;
      }
      const { data } = await supabase.auth.getSession();
      await applySession(data.session?.user.id ?? null);
      // Drenar lo que haya quedado pendiente de una sesión anterior (task_17).
      drainSyncQueue().catch(e => console.warn('drainSyncQueue error:', e));
    })();

    const authSubscription = supabase?.auth.onAuthStateChange((_event, session) => {
      void applySession(session?.user.id ?? null);
    }).data.subscription;

    // Al recuperar conectividad, reintentar la cola sin esperar al próximo guardado.
    const onOnline = () => { drainSyncQueue().catch(e => console.warn('drainSyncQueue error:', e)); };
    window.addEventListener('online', onOnline);
    return () => {
      alive = false;
      authSubscription?.unsubscribe();
      window.removeEventListener('online', onOnline);
    };
  }, []);

  const setEmpresa = useCallback(async (id: string) => {
    const emp = await empresaRepo.getById(id);
    setState(s => ({ ...s, empresaId: id, empresa: emp, unidadNumero: null, unidadConfig: null, cabeceraId: null }));
    // Best-effort, no bloquea la navegación: sin red sigue el umbral local/sembrado.
    pullUmbrales(id).then(res => {
      if (!res.ok && res.error) console.warn('pullUmbrales:', res.error);
    }).catch(e => console.warn('pullUmbrales error:', e));
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

  const signOut = useCallback(async () => {
    await signOutInspector();
    setState(s => ({ ...s, profile: null, empresaId: null, empresa: null, unidadNumero: null, unidadConfig: null, unidadTipoVehiculo: null, cabeceraId: null }));
  }, []);

  return (
    <AppContext.Provider value={{ ...state, setEmpresa, setUnidad, setCabecera, clearUnidad, signOut }}>
      {children}
    </AppContext.Provider>
  );
}
