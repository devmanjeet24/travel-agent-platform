import '@/global.css';

import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { NativeSplashGate } from '@/components/native-splash-gate';
import { queryClient } from '@/lib/query-client';
import { AuthProvider } from '@/providers/auth-provider';
import { store } from '@/store';

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Provider store={store}>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <NativeSplashGate>{children}</NativeSplashGate>
            </AuthProvider>
          </QueryClientProvider>
        </Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
