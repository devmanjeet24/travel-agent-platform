import { useQuery } from '@tanstack/react-query';

import { isSupabaseConfigured } from '@/lib/env';
import { authKeys, fetchAuthSession } from '@/services/auth';

export function useAuthSessionQuery() {
  const isConfigured = isSupabaseConfigured();

  return useQuery({
    queryKey: authKeys.session(),
    queryFn: fetchAuthSession,
    enabled: isConfigured,
    staleTime: Number.POSITIVE_INFINITY,
  });
}
