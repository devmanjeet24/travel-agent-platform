function errorFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const msg = (payload as { error?: string }).error;
  return typeof msg === 'string' && msg.trim() ? msg.trim() : null;
}

/** Extract the Edge Function JSON error body from invoke failures. */
export async function formatChatInvokeError(
  error: { message: string; context?: unknown; name?: string },
  data: unknown,
): Promise<string> {
  const fromData = errorFromPayload(data);
  if (fromData) return fromData;

  const context = error.context;
  if (context && typeof context === 'object' && 'json' in context) {
    try {
      const payload = await (context as Response).json();
      const fromContext = errorFromPayload(payload);
      if (fromContext) return fromContext;
    } catch {
      /* ignore parse errors */
    }
  }

  const msg = error.message;
  if (msg.includes('Failed to send a request to the Edge Function')) {
    return (
      'Chat Edge Function is not deployed (or unreachable). ' +
      'Run: supabase functions deploy chat. ' +
      'See docs/supabase-dashboard-setup.md.'
    );
  }

  if (msg.includes('non-2xx')) {
    return 'Chat request failed on the server. Redeploy with: supabase functions deploy chat — then check Edge Functions → chat → Logs in Supabase.';
  }

  return msg;
}

import {
  parseChatToolEffects,
  type ChatToolEffect,
} from '@/utils/chat-trip-sync';

export type ParsedChatResponse = {
  reply: string | null;
  conversationId?: string;
  warning?: string;
  tripId?: string;
  openTripId?: string;
  effects?: ChatToolEffect[];
};

export function parseChatReply(data: unknown): ParsedChatResponse {
  if (!data || typeof data !== 'object') {
    return { reply: null };
  }
  const obj = data as {
    reply?: string;
    conversationId?: string;
    warning?: string;
    tripId?: string;
    openTripId?: string;
    error?: string;
  };
  if (obj.error) {
    return { reply: null };
  }
  const reply = String(obj.reply ?? '').trim();
  return {
    reply: reply || null,
    conversationId: obj.conversationId,
    warning: obj.warning,
    tripId: obj.tripId,
    openTripId: obj.openTripId,
    effects: parseChatToolEffects(data),
  };
}
