import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, type ReactNode } from 'react';

import { NATIVE_SPLASH_MIN_MS } from '@/lib/native-splash';
import { useAuth } from '@/providers/auth-provider';

type Props = {
  children: ReactNode;
};

/**
 * Keeps the native splash visible for at least NATIVE_SPLASH_MIN_MS, then hides
 * once the initial auth session check has finished.
 */
export function NativeSplashGate({ children }: Props) {
  const { loading } = useAuth();
  const [minElapsed, setMinElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinElapsed(true), NATIVE_SPLASH_MIN_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (minElapsed && !loading) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [minElapsed, loading]);

  return <>{children}</>;
}
