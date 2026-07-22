import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { loadOperatorProfile, supabase } from '../lib/supabase';
import { loginIdentifierToEmail } from '../lib/model';
import type { OperatorProfile } from '../lib/types';

interface AuthValue {
  ready: boolean;
  session: Session | null;
  profile: OperatorProfile | null;
  error: string | null;
  signIn: (identifier: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  retryProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthValue | null>(null);

const PROFILE_CACHE = 'renova:movements:profile:v1';

function cachedProfile(userId: string): OperatorProfile | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROFILE_CACHE) ?? 'null') as OperatorProfile | null;
    return parsed?.id === userId ? parsed : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<OperatorProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hydrateProfile = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);
    if (!nextSession) {
      setProfile(null);
      setReady(true);
      return;
    }

    const cached = cachedProfile(nextSession.user.id);
    if (cached) setProfile(cached);

    try {
      const fresh = await loadOperatorProfile(nextSession.user.id);
      setProfile(fresh);
      localStorage.setItem(PROFILE_CACHE, JSON.stringify(fresh));
      setError(null);
    } catch (cause) {
      if (!cached) setError(cause instanceof Error ? cause.message : 'No se pudo cargar tu perfil.');
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setError('Falta configurar VITE_SUPABASE_URL y la clave publicable.');
      setReady(true);
      return;
    }

    void supabase.auth.getSession().then(({ data }) => hydrateProfile(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      window.setTimeout(() => void hydrateProfile(nextSession), 0);
    });
    return () => listener.subscription.unsubscribe();
  }, [hydrateProfile]);

  const signIn = useCallback(async (identifier: string, password: string) => {
    if (!supabase) throw new Error('La app no está conectada a RENOVA.');
    setError(null);
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: loginIdentifierToEmail(identifier),
      password,
    });
    if (authError) throw new Error('Usuario o contraseña incorrectos.');
    await hydrateProfile(data.session);
  }, [hydrateProfile]);

  const signOut = useCallback(async () => {
    localStorage.removeItem(PROFILE_CACHE);
    setProfile(null);
    if (supabase) await supabase.auth.signOut();
  }, []);

  const retryProfile = useCallback(async () => {
    setReady(false);
    await hydrateProfile(session);
  }, [hydrateProfile, session]);

  const value = useMemo<AuthValue>(() => ({
    ready, session, profile, error, signIn, signOut, retryProfile,
  }), [ready, session, profile, error, signIn, signOut, retryProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
