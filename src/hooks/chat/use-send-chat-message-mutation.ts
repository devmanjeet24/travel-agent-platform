import { useMutation } from '@tanstack/react-query';

import { sendChatMessageMutationFn } from '@/services/chat';

export function useSendChatMessageMutation() {
  return useMutation({
    mutationFn: sendChatMessageMutationFn,
  });
}
