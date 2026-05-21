import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/providers/auth-provider';
import { fetchProfile } from '@/services/profile/profile-api';

export const profileKeys = {
  detail: (userId: string) => ['profile', userId] as const,
};

export function useProfileQuery() {
  const { user } = useAuth();
  return useQuery({
    queryKey: profileKeys.detail(user?.id ?? ''),
    queryFn: () => fetchProfile(user!.id),
    enabled: Boolean(user?.id),
  });
}
