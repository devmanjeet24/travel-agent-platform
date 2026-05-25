import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import type { Session, User } from '@supabase/supabase-js';

import { useAuthSessionQuery } from '@/hooks/auth/use-auth-session-query';
import { collectAuthCallbackUrls, processAuthCallbackUrl } from '@/lib/auth-deep-link';
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

    const handleUrls = async (urls: string[]) => {
      for (const url of urls) {
        const { session: nextSession } = await processAuthCallbackUrl(url, queryClient);
        if (nextSession) break;
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      void handleUrls([window.location.href]);
    } else {
      void collectAuthCallbackUrls(null).then(handleUrls);
    }

    const linkSub =
      Platform.OS !== 'web'
        ? Linking.addEventListener('url', ({ url }) => {
            void processAuthCallbackUrl(url, queryClient);
          })
        : null;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      queryClient.setQueryData(authKeys.session(), nextSession);
    });

    return () => {
      linkSub?.remove();
      subscription.unsubscribe();
    };
  }, [isConfigured, queryClient]);

  const session = sessionQuery.data ?? null;
  const loading =
    isConfigured &&
    (sessionQuery.isLoading || (sessionQuery.isFetching && sessionQuery.data === undefined));
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
