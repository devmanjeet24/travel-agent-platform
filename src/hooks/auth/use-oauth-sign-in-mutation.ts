import { useMutation } from '@tanstack/react-query'

import { signInWithOAuth } from '@/lib/oauth'

export function useOAuthSignInMutation() {
  return useMutation({
    mutationFn: (provider: 'google' | 'apple') => signInWithOAuth(provider),
  })
}
