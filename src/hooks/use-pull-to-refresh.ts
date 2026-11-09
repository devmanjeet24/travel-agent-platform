import { useCallback, useRef, useState } from 'react';

/**
 * Pull-to-refresh handler that avoids overlapping refetches from rapid gestures.
 */
export function usePullToRefresh(refetch: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef(false);

  const onRefresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      inFlight.current = false;
      setRefreshing(false);
    }
  }, [refetch]);

  return { refreshing, onRefresh };
}
