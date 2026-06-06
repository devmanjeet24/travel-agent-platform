import { env } from '@/lib/env';
import { getSupabaseOrNull } from '@/lib/supabase';
import { sendChatMessage } from '@/services/chat/chat-mutation-fns';
import type { SendChatVariables } from '@/services/chat/chat-types';
import {
  parseChatToolEffects,
  type ChatToolEffect,
} from '@/utils/chat-trip-sync';

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

const CHAT_RETRY_DELAYS_MS = [1500, 3500]

function newClientRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function isRetryableChatError(status: number, body: { retryable?: boolean; error?: string }): boolean {
  if (body.retryable) return true
  if (status === 409) return true
  if (status !== 503) return false
  const msg = body.error ?? ''
  return (
    /rate limit|429|briefly busy|tokens per minute|tool call validation/i.test(msg)
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Progressive display when the Edge Function returns one JSON blob (invoke fallback). */
async function emitChunkedReply(
  reply: string,
  callbacks: StreamChatCallbacks,
): Promise<void> {
  const chunks = reply.match(/\S+\s*|\s+/g) ?? [reply]
  for (const chunk of chunks) {
    if (!chunk) continue
    callbacks.onDelta(chunk)
    await sleep(18)
  }
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
    tripId?: string;
    openTripId?: string;
    effects?: ChatToolEffect[];
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
        tripId?: string;
        openTripId?: string;
        effects?: ChatToolEffect[];
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
          tripId: data.tripId,
          openTripId: data.openTripId,
          effects: parseChatToolEffects(data),
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
  let receivedStreamPayload = false
  for (let attempt = 0; attempt <= CHAT_RETRY_DELAYS_MS.length; attempt += 1) {
    const headers = await getEdgeAuthHeaders()
    if (!headers) {
      callbacks.onError('Sign in to use AI chat.')
      return true
    }

    let res: Response
    try {
      res = await fetch(edgeFunctionUrl('chat'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...body, stream: true }),
      })
    } catch {
      if (attempt < CHAT_RETRY_DELAYS_MS.length) {
        await sleep(CHAT_RETRY_DELAYS_MS[attempt])
        continue
      }
      callbacks.onError(
        'Network error. Deploy the chat function and check EXPO_PUBLIC_SUPABASE_URL.',
      )
      return true
    }

    if (!res.ok) {
      const errJson = (await res.json().catch(() => ({}))) as {
        error?: string
        retryable?: boolean
      }
      if (res.status === 404) {
        callbacks.onError(
          'Chat function not deployed. Run: supabase functions deploy chat',
        )
        return true
      }
      if (
        isRetryableChatError(res.status, errJson) &&
        attempt < CHAT_RETRY_DELAYS_MS.length
      ) {
        await sleep(res.status === 409 ? CHAT_RETRY_DELAYS_MS[attempt] + 1000 : CHAT_RETRY_DELAYS_MS[attempt])
        continue
      }
      callbacks.onError(errJson.error ?? `Request failed (${res.status})`)
      return true
    }

    const reader = res.body?.getReader?.()
    if (!reader) return false

    const decoder = new TextDecoder()
    let buffer = ''
    let completed = false
    const wrapped: StreamChatCallbacks = {
      ...callbacks,
      onDelta: (text) => {
        receivedStreamPayload = true
        callbacks.onDelta(text)
      },
      onDone: (result) => {
        completed = true
        callbacks.onDone(result)
      },
      onError: (msg) => {
        completed = true
        callbacks.onError(msg)
      },
    }

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        buffer = parseSseLines(buffer, wrapped)
      }
      if (buffer.trim()) parseSseLines(`${buffer}\n`, wrapped)
      if (!completed && buffer.includes('"done":true')) {
        parseSseLines(`${buffer}\n`, wrapped)
      }
      if (completed || receivedStreamPayload) return true
      return false
    } catch {
      if (completed || receivedStreamPayload) return true
      if (buffer.includes('"done":true')) {
        parseSseLines(`${buffer}\n`, wrapped)
        return true
      }
      return false
    }
  }

  return false
}

/**
 * Send chat message: SSE streaming via fetch when supported; invoke + chunked fallback otherwise.
 */
export async function sendChatWithStream(
  variables: SendChatVariables,
  callbacks: StreamChatCallbacks,
): Promise<void> {
  const clientRequestId = variables.clientRequestId ?? newClientRequestId();
  const body = {
    message: variables.message,
    history: variables.history,
    conversationId: variables.conversationId,
    tripId: variables.tripId,
    attachments: variables.attachments,
    tripContext: variables.tripContext,
    clientRequestId,
  };

  const streamed = await streamViaFetch(body, callbacks);
  if (streamed) return;

  for (let attempt = 0; attempt <= CHAT_RETRY_DELAYS_MS.length; attempt += 1) {
    const result = await sendChatMessage({
      ...variables,
      clientRequestId,
      stream: false,
    });

    if (!result.error && result.reply) {
      if (result.warning) callbacks.onWarning?.(result.warning);
      await emitChunkedReply(result.reply, callbacks);
      callbacks.onDone({
        reply: result.reply,
        conversationId: result.conversationId,
        warning: result.warning,
        tripId: result.tripId,
        openTripId: result.openTripId,
        effects: result.effects,
      });
      return;
    }

    const retryable =
      Boolean(result.error) &&
      /rate limit|429|briefly busy|tokens per minute|tool call validation/i.test(
        result.error ?? '',
      );
    if (retryable && attempt < CHAT_RETRY_DELAYS_MS.length) {
      await sleep(CHAT_RETRY_DELAYS_MS[attempt]);
      continue;
    }

    callbacks.onError(result.error ?? 'Empty response from AI');
    return;
  }
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
