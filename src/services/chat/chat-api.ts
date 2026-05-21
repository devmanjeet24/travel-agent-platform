export function formatChatInvokeError(
  error: { message: string; context?: unknown },
  data: unknown,
): string {
  if (data && typeof data === 'object' && data !== null && 'error' in data) {
    const msg = (data as { error?: string }).error;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }

  const msg = error.message;
  if (msg.includes('Failed to send a request to the Edge Function')) {
    return (
      'Chat Edge Function is not deployed (or unreachable). ' +
      'Run: supabase functions deploy chat. ' +
      'See docs/supabase-dashboard-setup.md.'
    );
  }

  return msg;
}

export type ParsedChatResponse = {
  reply: string | null;
  conversationId?: string;
  warning?: string;
};

export function parseChatReply(data: unknown): ParsedChatResponse {
  if (!data || typeof data !== 'object') {
    return { reply: null };
  }
  const obj = data as {
    reply?: string;
    conversationId?: string;
    warning?: string;
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
  };
}
