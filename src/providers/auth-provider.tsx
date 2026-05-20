import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';

import { isSupabaseConfigured } from '@/lib/env';
import { getSupabaseOrNull } from '@/lib/supabase';
import { getUserDisplayName } from '@/services/auth.service';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  displayName: string;
  loading: boolean;
  isConfigured: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const isConfigured = isSupabaseConfigured();

  useEffect(() => {
    const supabase = getSupabaseOrNull();
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const user = session?.user ?? null;
  const displayName = useMemo(() => getUserDisplayName(user), [user]);

  const value = useMemo(
    () => ({
      session,
      user,
      displayName,
      loading,
      isConfigured,
    }),
    [session, user, displayName, loading, isConfigured],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

/** Safe hook for optional auth-aware UI outside strict provider checks. */
export function useAuthOptional(): AuthContextValue | null {
  return useContext(AuthContext);
}
