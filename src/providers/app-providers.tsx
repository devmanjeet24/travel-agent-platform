import '@/global.css';

import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { NativeSplashGate } from '@/components/native-splash-gate';
import { queryClient } from '@/lib/query-client';
import { persistOptions } from '@/lib/query-persist';
import { AuthProvider } from '@/providers/auth-provider';
import { SyncProviders } from '@/providers/sync-providers';
import { ThemePreferenceProvider } from '@/providers/theme-preference-provider';
import { store } from '@/store';

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Provider store={store}>
          <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
            <ThemePreferenceProvider>
              <AuthProvider>
                <SyncProviders>
                  <NativeSplashGate>{children}</NativeSplashGate>
                </SyncProviders>
              </AuthProvider>
            </ThemePreferenceProvider>
          </PersistQueryClientProvider>
        </Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
