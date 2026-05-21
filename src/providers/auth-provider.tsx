import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Session, User } from '@supabase/supabase-js';

import { useAuthSessionQuery } from '@/hooks/auth/use-auth-session-query';
import { isSupabaseConfigured } from '@/lib/env';
import { getSupabaseOrNull } from '@/lib/supabase';
import { authKeys, getUserDisplayName } from '@/services/auth';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  displayName: string;
  loading: boolean;
  isConfigured: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const isConfigured = isSupabaseConfigured();
  const sessionQuery = useAuthSessionQuery();

  useEffect(() => {
    if (!isConfigured) return;
    const supabase = getSupabaseOrNull();
    if (!supabase) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      queryClient.setQueryData(authKeys.session(), nextSession);
    });

    return () => subscription.unsubscribe();
  }, [isConfigured, queryClient]);

  const session = sessionQuery.data ?? null;
  // Only block UI on the first session fetch (no cached data yet).
  // isPending stays true during background refetches and would remount auth screens.
  const loading = isConfigured && sessionQuery.isLoading;
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
