import { useMutation } from '@tanstack/react-query';

import { resetPasswordMutationFn } from '@/services/auth';

export function useResetPasswordMutation() {
  return useMutation({
    mutationFn: resetPasswordMutationFn,
  });
}
