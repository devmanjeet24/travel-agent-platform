import * as SplashScreen from 'expo-splash-screen';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold, useFonts } from '@expo-google-fonts/inter';
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
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  useEffect(() => {
    const timer = setTimeout(() => setMinElapsed(true), NATIVE_SPLASH_MIN_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (minElapsed && !loading && (fontsLoaded || !!fontError)) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontError, fontsLoaded, minElapsed, loading]);

  return <>{children}</>;
}
