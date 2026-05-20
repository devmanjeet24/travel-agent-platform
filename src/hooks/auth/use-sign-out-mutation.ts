import { useMutation } from '@tanstack/react-query';

import { signOutMutationFn } from '@/services/auth';

export function useSignOutMutation() {
  return useMutation({
    mutationFn: signOutMutationFn,
  });
}
