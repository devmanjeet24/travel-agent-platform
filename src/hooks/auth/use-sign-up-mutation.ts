import { useMutation } from '@tanstack/react-query';

import { signUpWithEmailMutationFn } from '@/services/auth';

export function useSignUpMutation() {
  return useMutation({
    mutationFn: signUpWithEmailMutationFn,
  });
}
