import { useMutation } from '@tanstack/react-query';

import { signInWithEmailMutationFn } from '@/services/auth';

export function useSignInMutation() {
  return useMutation({
    mutationFn: signInWithEmailMutationFn,
  });
}
