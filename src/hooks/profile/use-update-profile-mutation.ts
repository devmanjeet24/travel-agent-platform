import { useMutation, useQueryClient } from '@tanstack/react-query';

import { profileKeys } from '@/hooks/profile/use-profile-query';
import { updateProfileSettings } from '@/services/profile/profile-api';
import type { ProfileRow } from '@/types/database';
import { useAuth } from '@/providers/auth-provider';

export type UpdateProfileInput = {
  display_name: string;
};

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: UpdateProfileInput) => {
      if (!user?.id) throw new Error('Sign in to update your profile');
      const display_name = input.display_name.trim();
      if (!display_name) throw new Error('Enter a display name');
      return updateProfileSettings(user.id, { display_name });
    },
    onSuccess: (profile) => {
      if (user?.id) {
        queryClient.setQueryData<ProfileRow | null>(profileKeys.detail(user.id), profile);
      }
    },
  });
}
