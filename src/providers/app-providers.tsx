import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';

import { queryClient } from '@/lib/query-client';
import { store } from '@/store';

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </Provider>
  );
}
