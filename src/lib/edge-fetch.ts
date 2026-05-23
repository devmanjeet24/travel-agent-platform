import { env } from '@/lib/env';
import { getSupabaseOrNull } from '@/lib/supabase';
import { sendChatMessage } from '@/services/chat/chat-mutation-fns';
import type { SendChatVariables } from '@/services/chat/chat-types';

export async function getEdgeAuthHeaders(
  contentType = 'application/json',
): Promise<Record<string, string> | null> {
  const supabase = getSupabaseOrNull();
  if (!supabase || !env.supabaseUrl || !env.supabaseAnonKey) return null;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return null;

  return {
    Authorization: `Bearer ${session.access_token}`,
    apikey: env.supabaseAnonKey,
    'Content-Type': contentType,
  };
}

export function edgeFunctionUrl(name: string): string {
  const base = env.supabaseUrl.replace(/\/$/, '');
  return `${base}/functions/v1/${name}`;
}

export type StreamChatCallbacks = {
  onDelta: (text: string) => void;
  onDone: (result: {
    reply: string;
    conversationId?: string;
    title?: string;
    warning?: string;
  }) => void;
  onError: (message: string) => void;
  onWarning?: (message: string) => void;
};

function parseSseLines(
  buffer: string,
  callbacks: StreamChatCallbacks,
): string {
  const lines = buffer.split('\n');
  let remainder = lines.pop() ?? '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === '[DONE]') continue;
    try {
      const data = JSON.parse(payload) as {
        delta?: string;
        done?: boolean;
        reply?: string;
        conversationId?: string;
        title?: string;
        error?: string;
        warning?: string;
      };
      if (data.error) {
        callbacks.onError(data.error);
        return '';
      }
      if (data.warning) callbacks.onWarning?.(data.warning);
      if (data.delta) callbacks.onDelta(data.delta);
      if (data.done && data.reply != null) {
        callbacks.onDone({
          reply: data.reply,
          conversationId: data.conversationId,
          title: data.title,
          warning: data.warning,
        });
      }
    } catch {
      /* ignore partial JSON */
    }
  }

  return remainder;
}

async function streamViaFetch(
  body: Record<string, unknown>,
  callbacks: StreamChatCallbacks,
): Promise<boolean> {
  const headers = await getEdgeAuthHeaders();
  if (!headers) {
    callbacks.onError('Sign in to use AI chat.');
    return true;
  }

  let res: Response;
  try {
    res = await fetch(edgeFunctionUrl('chat'), {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...body, stream: true }),
    });
  } catch {
    callbacks.onError(
      'Network error. Deploy the chat function and check EXPO_PUBLIC_SUPABASE_URL.',
    );
    return true;
  }

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    if (res.status === 404) {
      callbacks.onError(
        'Chat function not deployed. Run: supabase functions deploy chat',
      );
      return true;
    }
    callbacks.onError(
      (errJson as { error?: string }).error ?? `Request failed (${res.status})`,
    );
    return true;
  }

  const reader = res.body?.getReader?.();
  if (!reader) return false;

  const decoder = new TextDecoder();
  let buffer = '';
  let completed = false;
  const wrapped: StreamChatCallbacks = {
    ...callbacks,
    onDone: (result) => {
      completed = true;
      callbacks.onDone(result);
    },
    onError: (msg) => {
      completed = true;
      callbacks.onError(msg);
    },
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      buffer = parseSseLines(buffer, wrapped);
    }
    if (buffer.trim()) parseSseLines(`${buffer}\n`, wrapped);
    return completed;
  } catch {
    return false;
  }
}

/**
 * Send chat message: streaming on native when possible; reliable JSON invoke on web / fallback.
 */
export async function sendChatWithStream(
  variables: SendChatVariables,
  callbacks: StreamChatCallbacks,
): Promise<void> {
  const body = {
    message: variables.message,
    history: variables.history,
    conversationId: variables.conversationId,
    tripId: variables.tripId,
    attachments: variables.attachments,
    tripContext: variables.tripContext,
  };

  const streamed = await streamViaFetch(body, callbacks);
  if (streamed) return;

  const result = await sendChatMessage({
    ...variables,
    stream: false,
  });

  if (result.error || !result.reply) {
    callbacks.onError(result.error ?? 'Empty response from AI');
    return;
  }

  if (result.warning) callbacks.onWarning?.(result.warning);

  callbacks.onDone({
    reply: result.reply,
    conversationId: result.conversationId,
    warning: result.warning,
  });
}

/** @deprecated Use sendChatWithStream */
export async function streamEdgeChat(
  body: Record<string, unknown>,
  callbacks: StreamChatCallbacks,
): Promise<void> {
  await sendChatWithStream(
    {
      message: String(body.message ?? ''),
      history: (body.history as SendChatVariables['history']) ?? [],
      conversationId: body.conversationId as string | undefined,
      tripId: body.tripId as string | undefined,
    },
    callbacks,
  );
}
