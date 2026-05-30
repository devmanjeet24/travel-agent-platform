import type { ReactNode } from 'react';

import { usePushNotificationsBootstrap } from '@/hooks/push/use-push-notifications-bootstrap';
import { useOfflineSync } from '@/hooks/use-offline-sync';

/** Side-effect hooks for push registration and offline sync (no UI). */
export function SyncProviders({ children }: { children: ReactNode }) {
  usePushNotificationsBootstrap();
  useOfflineSync();
  return children;
}
