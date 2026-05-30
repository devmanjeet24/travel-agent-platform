import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

import { isOfflinePersistedQueryKey } from '@/lib/offline-query-keys';
import { isOfflineSyncEnabled } from '@/lib/offline-sync-state';

export const OFFLINE_CACHE_STORAGE_KEY = 'REACT_QUERY_OFFLINE_CACHE';

export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: OFFLINE_CACHE_STORAGE_KEY,
  throttleTime: 2000,
});

export const persistOptions = {
  persister: asyncStoragePersister,
  maxAge: 1000 * 60 * 60 * 24 * 7,
  dehydrateOptions: {
    shouldDehydrateQuery: (query: { queryKey: readonly unknown[] }) => {
      if (!isOfflineSyncEnabled()) return false;
      return isOfflinePersistedQueryKey(query.queryKey);
    },
  },
} as const;
