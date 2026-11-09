import { getSupabaseOrNull } from '@/lib/supabase';

import { formatChatInvokeError, parseChatReply } from './chat-api';
import type { ChatResult, SendChatVariables } from './chat-types';

export async function sendChatMessage(
  variables: SendChatVariables,
): Promise<ChatResult> {
  const supabase = getSupabaseOrNull();
  if (!supabase) {
    return {
      reply: null,
      error: 'Supabase is not configured. Check your .env file.',
    };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { reply: null, error: 'Sign in to use AI chat.' };
  }

  const { data, error } = await supabase.functions.invoke('chat', {
    body: {
      message: variables.message,
      history: variables.history,
      conversationId: variables.conversationId,
      clientRequestId: variables.clientRequestId,
      tripId: variables.tripId,
      attachments: variables.attachments,
      tripContext: variables.tripContext,
      stream: false,
    },
  });

  if (error) {
    return { reply: null, error: await formatChatInvokeError(error, data) };
  }

  const parsed = parseChatReply(data);
  if (!parsed.reply) {
    const bodyError =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error?: string }).error ?? '')
        : '';
    return {
      reply: null,
      error: bodyError.trim() || 'Empty response from AI.',
    };
  }

  return {
    reply: parsed.reply,
    error: null,
    conversationId: parsed.conversationId,
    warning: parsed.warning,
    tripId: parsed.tripId,
    openTripId: parsed.openTripId,
    effects: parsed.effects,
  };
}

export function sendChatMessageMutationFn(
  variables: SendChatVariables,
): Promise<ChatResult> {
  return sendChatMessage(variables);
}
