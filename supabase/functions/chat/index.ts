import { handleOptions, jsonResponse, corsHeaders } from '../_shared/cors.ts';
import { requireUser } from '../_shared/auth.ts';
import { CHAT_TRANSPORT_HINT_SHORT } from '../_shared/plan-prompt.ts';
import { buildTravelContext } from '../_shared/travel-apis.ts';
import { fetchGroqWith429Retry } from '../_shared/groq-fetch.ts';
import { logGroqUsage } from '../_shared/groq-usage.ts';
import { safeDb } from '../_shared/db.ts';
import {
  assessTripRequirements,
  allowSavedTripCreateFromChat,
  buildChatMemoryContext,
  executeChatTool,
  canPersistTripFromChat,
  finalizeTripOnUserConfirmation,
  finalizeTripPersistResult,
  TRIP_SAVE_FAILURE_REPLY,
  tripWasPersistedFromEffects,
  verifyTripSavedForUser,
  buildConversationGatheredContext,
  formatGatheredTripDetailsSection,
  logTripPersistPipeline,
  maybeAutoPersistTrip,
  maybeAutoDeleteTrip,
  messageNeedsChatTools,
  messageIsTripsTabNavigationIntent,
  selectChatAgentTools,
  CHAT_AGENT_TOOLS,
  findChatRequestReplay,
  isChatRequestInFlight,
  stripRawToolMarkupFromReply,
  type ChatHistoryMessage,
  type ChatToolEffect,
  type GatheredTripContext,
} from '../_shared/chat-tools.ts';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL_8B = 'llama-3.1-8b-instant';
const MAX_HISTORY_TURNS = 4;
const MAX_MESSAGE_CHARS = 800;
const MAX_TOOL_RESULT_CHARS = 2_500;
const deno = globalThis as typeof globalThis & {
  Deno: {
    env: { get(name: string): string | undefined };
    serve(handler: (req: Request) => Response | Promise<Response>): void;
  };
};

const SYSTEM_PROMPT = `You are a concise in-app AI travel agent for Indian travelers.

Rules:
- NEVER include [CHAT MEMORY], [TRIP MEMORY], [GATHERED TRIP DETAILS], [CLIENT TRIP CONTEXT], [AUTO ACTION], or any bracketed internal sections in your reply. Those blocks are private context only — respond with normal conversational text.
- Saved trips: use [TRIP MEMORY] and tools only; never invent saved-trip facts.
- Continue from [CHAT MEMORY], [GATHERED TRIP DETAILS], and recent messages in this thread only. Never re-ask for fields listed as Known.
- If Still needed shows "none", do NOT ask any trip planning questions — the app auto-saves; confirm only after [AUTO ACTION].
- New conversations: never reuse destination, dates, budget, or travelers from other chats or old saved trips unless the user explicitly references them.
- Ask at most one short follow-up only for fields listed under Still needed.
- Required before saving: destination, origin, start date, end date or trip duration, travelers, and INR budget.
- Never invent or assume travel dates, trip duration, budget, or traveler count.
- When required fields are missing, ask for them one at a time. Do not create or save a trip.
- When all required fields are known, the app auto-saves the trip — never ask "Should I create the trip?" or wait for creation confirmation.
- Flight/train/transport preference is optional and is NOT required to save a trip. Never ask for transport mode before the trip is saved.
- If [AUTO ACTION] shows create_trip or update_trip succeeded, confirm the trip is saved and opening in Trips; do not re-ask known fields.
- create_trip requires every field from the conversation; call update_trip or delete_trip when the user asks to change or remove a trip.
- After create_trip or update_trip succeeds, confirm the trip is saved and the user can view it in the Trips tab.
- DB changes only via tools; never claim a mutation unless a tool succeeded.
- Trip deletion only via delete_trip; confirm removal only after the tool returns success.
- When the user asks to change trip details, call update_trip with the new values before saying the trip was updated.
- On create_trip, generatePlan defaults to true — always build itinerary, budget, and packing unless the user explicitly wants a draft-only trip.
- If [CLIENT TRIP CONTEXT] or [GATHERED TRIP DETAILS] includes origin, use it automatically and never ask for origin city unless the user wants to change it.
- Never claim a trip was saved or deleted unless [AUTO ACTION] or a tool effect succeeded.
- [LIVE TRAVEL DATA]: weather, named hotels/places, real trains only when present; mark estimates as approximate; no invented train numbers if [AI TRAIN FALLBACK].
${CHAT_TRANSPORT_HINT_SHORT}
Reply in 2–5 short sentences unless the user asks for detail.`;

const CHAT_SUMMARY_PREFIX = 'CHAT_SUMMARY:';

function isWeakDestinationLabel(destination: string): boolean {
  const normalized = destination.trim().toLowerCase();
  return (
    normalized.length < 3 ||
    /^(this|that|there|here)(\s+trip)?$/.test(normalized) ||
    normalized === 'this trip' ||
    normalized === 'the trip'
  );
}

function isLikelyToNeedLiveTravelData(params: {
  destination?: string;
  message: string;
  hasActiveTrip: boolean;
}): boolean {
  const m = params.message.toLowerCase();
  if (!params.destination) return false;
  if (isWeakDestinationLabel(params.destination)) return false;
  // Weather/clothing and explicit travel-option questions benefit from live data.
  return /weather|climate|temperature|rain|clothes|clothing|what to wear|things to do|restaurants?|food|hotels?|flights?|trains?|buses?|transport|stay|accommodation|where to stay/.test(
    m,
  );
}

function trimHistoryMessage(content: string): string {
  const trimmed = content.trim();
  if (trimmed.length <= MAX_MESSAGE_CHARS) return trimmed;
  return `${trimmed.slice(0, MAX_MESSAGE_CHARS - 1)}…`;
}

function formatClientTripContext(ctx: RequestBody['tripContext']): string | null {
  if (!ctx) return null;
  const lines: string[] = [];
  if (ctx.destination?.trim()) lines.push(`Destination: ${ctx.destination.trim()}`);
  if (ctx.origin?.trim()) {
    lines.push(
      `Origin city: ${ctx.origin.trim()} (from device GPS or user input — do not ask for origin unless they want to change it)`,
    );
  }
  if (ctx.startDate?.trim()) lines.push(`Start date: ${ctx.startDate.trim()}`);
  if (ctx.endDate?.trim()) lines.push(`End date: ${ctx.endDate.trim()}`);
  if (ctx.tripDurationDays != null && Number.isFinite(ctx.tripDurationDays)) {
    lines.push(`Trip duration (days): ${ctx.tripDurationDays}`);
  }
  if (ctx.budgetInr != null && Number.isFinite(ctx.budgetInr)) {
    lines.push(`Budget INR: ${ctx.budgetInr}`);
  }
  if (ctx.travelers != null && Number.isFinite(ctx.travelers)) {
    lines.push(`Travelers: ${ctx.travelers}`);
  }
  return lines.length ? lines.join('\n') : null;
}

type ChatMessage = ChatHistoryMessage;

type RequestBody = {
  message?: string;
  history?: ChatMessage[];
  stream?: boolean;
  conversationId?: string;
  /** Client-generated idempotency key — one user send must map to one server turn. */
  clientRequestId?: string;
  tripId?: string;
  attachments?: Array<{ url: string; name: string; type: string }>;
  tripContext?: {
    destination?: string;
    origin?: string;
    startDate?: string;
    endDate?: string;
    tripDurationDays?: number;
    budgetInr?: number;
    travelers?: number;
  };
};

type GroqToolCall = {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments?: string;
  };
};

type GroqMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: GroqToolCall[];
};

type AssistantRunResult = {
  reply: string;
  effects: ChatToolEffect[];
  openTripId?: string;
  connectedTripId?: string;
};

function lastEffectTripId(effects: ChatToolEffect[]): string | undefined {
  for (let i = effects.length - 1; i >= 0; i -= 1) {
    if (effects[i].tripId) return effects[i].tripId;
  }
  return undefined;
}

function fallbackTitle(message: string): string {
  const cleaned = message.replace(/\[Attachments:[^\]]+\]/gi, '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'New trip chat';
  const words = cleaned.split(/\s+/).slice(0, 8).join(' ');
  return words.length > 56 ? `${words.slice(0, 53)}…` : words;
}

function generateConversationTitle(message: string): string {
  return fallbackTitle(message);
}

function hasCurrentUserMessage(history: ChatHistoryMessage[], message: string): boolean {
  const latestUser = [...history].reverse().find((item) => item.role === 'user');
  return latestUser?.content.trim() === message.trim();
}

function parseToolArgs(raw: string | undefined): Record<string, unknown> {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function compactJson(value: unknown, max = MAX_TOOL_RESULT_CHARS): string {
  const json = JSON.stringify(value);
  return json.length > max ? `${json.slice(0, max - 1)}…` : json;
}

async function callGroq(
  groqKey: string,
  messages: GroqMessage[],
  useTools: boolean,
  model: string,
  maxTokens: number,
  usageLabel: string,
  usageMeta?: { conversation_id?: string; user_id?: string; step?: number },
  tools?: typeof CHAT_AGENT_TOOLS,
): Promise<Record<string, any>> {
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: 0.5,
    max_tokens: maxTokens,
  };
  if (useTools) {
    body.tools = tools ?? CHAT_AGENT_TOOLS;
    body.tool_choice = 'auto';
  }

  const res = await fetchGroqWith429Retry(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${groqKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (res.status === 429) {
    throw new Error('RATE_LIMIT_RETRY_EXHAUSTED');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errMsg = data?.error?.message ?? 'Groq API request failed';
    if (/rate limit|429|tokens per minute/i.test(String(errMsg))) {
      throw new Error('RATE_LIMIT_RETRY_EXHAUSTED');
    }
    if (/tool call validation failed/i.test(String(errMsg))) {
      throw new Error('TOOL_CALL_VALIDATION_FAILED');
    }
    throw new Error(errMsg);
  }
  logGroqUsage(usageLabel, data as Record<string, unknown>, model, usageMeta);
  return data;
}

function mergeStreamedToolCallDelta(
  acc: Map<number, GroqToolCall>,
  deltas: Array<{
    index?: number;
    id?: string;
    type?: string;
    function?: { name?: string; arguments?: string };
  }>,
): void {
  for (const delta of deltas) {
    const index = delta.index ?? 0;
    let existing = acc.get(index);
    if (!existing) {
      existing = {
        id: delta.id ?? '',
        type: 'function',
        function: { name: '', arguments: '' },
      };
      acc.set(index, existing);
    }
    if (delta.id) existing.id = delta.id;
    if (delta.function?.name) {
      existing.function.name = `${existing.function.name ?? ''}${delta.function.name}`;
    }
    if (delta.function?.arguments) {
      existing.function.arguments =
        `${existing.function.arguments ?? ''}${delta.function.arguments}`;
    }
  }
}

async function callGroqStream(
  groqKey: string,
  messages: GroqMessage[],
  useTools: boolean,
  model: string,
  maxTokens: number,
  onDelta: (text: string) => void,
  usageLabel: string,
  usageMeta?: { conversation_id?: string; user_id?: string; step?: number },
  tools?: typeof CHAT_AGENT_TOOLS,
): Promise<Record<string, any>> {
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: 0.5,
    max_tokens: maxTokens,
    stream: true,
  };
  if (useTools) {
    body.tools = tools ?? CHAT_AGENT_TOOLS;
    body.tool_choice = 'auto';
  }

  const res = await fetchGroqWith429Retry(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${groqKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (res.status === 429) {
    throw new Error('RATE_LIMIT_RETRY_EXHAUSTED');
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const errMsg = data?.error?.message ?? 'Groq API request failed';
    if (/rate limit|429|tokens per minute/i.test(String(errMsg))) {
      throw new Error('RATE_LIMIT_RETRY_EXHAUSTED');
    }
    if (/tool call validation failed/i.test(String(errMsg))) {
      throw new Error('TOOL_CALL_VALIDATION_FAILED');
    }
    throw new Error(errMsg);
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error('Groq stream body unavailable');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  const toolCallsByIndex = new Map<number, GroqToolCall>();
  let lastUsage: Record<string, unknown> | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;

      let parsed: Record<string, any>;
      try {
        parsed = JSON.parse(payload);
      } catch {
        continue;
      }

      if (parsed.usage) lastUsage = parsed;

      const delta = parsed?.choices?.[0]?.delta;
      if (!delta) continue;

      if (typeof delta.content === 'string' && delta.content.length > 0) {
        content += delta.content;
        onDelta(delta.content);
      }

      if (Array.isArray(delta.tool_calls)) {
        mergeStreamedToolCallDelta(toolCallsByIndex, delta.tool_calls);
      }
    }
  }

  const toolCalls = [...toolCallsByIndex.values()].filter((tc) => tc.function.name);
  const synthetic = {
    choices: [{
      message: {
        content: content || null,
        tool_calls: toolCalls.length ? toolCalls : undefined,
      },
    }],
    ...(lastUsage ? { usage: lastUsage } : {}),
  };
  logGroqUsage(usageLabel, synthetic as Record<string, unknown>, model, usageMeta);
  return synthetic;
}

function withoutToolMessages(messages: GroqMessage[]): GroqMessage[] {
  return messages
    .filter((message) => message.role !== 'tool')
    .map((message) => ({
      role: message.role === 'assistant' ? 'assistant' : message.role,
      content: message.content ?? '',
    })) as GroqMessage[];
}

async function runAssistantWithTools(input: {
  groqKey: string;
  messages: GroqMessage[];
  supabase: any;
  userId: string;
  authHeader: string;
  model: string;
  maxTokens: number;
  useTools: boolean;
  conversationId?: string;
  activeTripId?: string;
  conversationTripId?: string;
  allowSavedTripCreate?: boolean;
  priorCreatedTripId?: string;
  gatheredTripContext?: GatheredTripContext;
  onStreamDelta?: (delta: string) => void;
}): Promise<AssistantRunResult> {
  const conversationId = input.conversationId;
  const messages = [...input.messages];
  const effects: ChatToolEffect[] = [];
  const agentTools = selectChatAgentTools();
  let sessionCreatedTripId = input.priorCreatedTripId;
  const sessionDeletedTripIds = new Set<string>();
  const usageMeta = {
    conversation_id: input.conversationId,
    user_id: input.userId,
  };

  for (let step = 0; step < (input.useTools ? 5 : 1); step += 1) {
    let data: Record<string, any>;
    try {
      if (input.onStreamDelta) {
        data = await callGroqStream(
          input.groqKey,
          messages,
          input.useTools,
          input.model,
          input.maxTokens,
          input.onStreamDelta,
          input.useTools ? 'chat_tools' : 'chat_reply',
          { ...usageMeta, step },
          agentTools,
        );
      } else {
        data = await callGroq(
          input.groqKey,
          messages,
          input.useTools,
          input.model,
          input.maxTokens,
          input.useTools ? 'chat_tools' : 'chat_reply',
          { ...usageMeta, step },
          agentTools,
        );
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '';
      if (step > 0) {
        if (sessionCreatedTripId) {
          const verified = await verifyTripSavedForUser(
            input.supabase,
            input.userId,
            sessionCreatedTripId,
          );
          if (verified) {
            return {
              reply:
                'Your trip has been saved. You can view it in the Trips tab — I had a brief delay finishing my full reply.',
              effects,
              openTripId: sessionCreatedTripId,
              connectedTripId: sessionCreatedTripId,
            };
          }
        }
        throw error;
      }
      if (errMsg === 'TOOL_CALL_VALIDATION_FAILED' && input.useTools) {
        data = await callGroq(
          input.groqKey,
          withoutToolMessages(messages),
          false,
          input.model,
          input.maxTokens,
          'chat_reply_tool_validation_fallback',
          usageMeta,
        );
      } else {
      // If the tool-using call fails, fall back to a plain response.
      data = await callGroq(
        input.groqKey,
        withoutToolMessages(messages),
        false,
        input.model,
        input.maxTokens,
        'chat_reply_fallback',
        usageMeta,
      );
      }
    }

    const assistantMessage = data?.choices?.[0]?.message ?? {};
    const toolCalls = Array.isArray(assistantMessage.tool_calls)
      ? assistantMessage.tool_calls as GroqToolCall[]
      : [];

    if (!toolCalls.length) {
      const reply = stripRawToolMarkupFromReply(String(assistantMessage.content ?? ''));
      return {
        reply: reply || 'I have the context now. What would you like to do next?',
        effects,
        openTripId: effects.find((effect) => effect.openTripId)?.openTripId,
        connectedTripId: lastEffectTripId(effects),
      };
    }

    messages.push({
      role: 'assistant',
      content: assistantMessage.content ?? '',
      tool_calls: toolCalls,
    });

    for (const toolCall of toolCalls) {
      let result: Awaited<ReturnType<typeof executeChatTool>>;
      const toolArgs = parseToolArgs(toolCall.function.arguments);
      const toolTripId = typeof toolArgs.tripId === 'string' ? toolArgs.tripId : undefined;

      if (toolCall.function.name === 'delete_trip' && toolTripId && sessionDeletedTripIds.has(toolTripId)) {
        result = {
          toolResult: {
            success: true,
            alreadyDeleted: true,
            tripId: toolTripId,
            message: 'Trip was already removed in this request.',
          },
          effect: {
            type: 'delete_trip',
            tripId: toolTripId,
            summary: 'Trip already deleted in this request.',
          },
        };
      } else if (toolCall.function.name === 'create_trip' && sessionCreatedTripId) {
        const verified = await verifyTripSavedForUser(
          input.supabase,
          input.userId,
          sessionCreatedTripId,
        );
        if (!verified) {
          result = {
            toolResult: {
              success: false,
              error: 'The trip from this request is not in your account. Please try confirming again.',
            },
          };
        } else {
          result = {
            toolResult: {
              success: true,
              alreadyExists: true,
              tripId: sessionCreatedTripId,
              openTripId: sessionCreatedTripId,
              message:
                'Only one trip can be created per request. Returning the trip already created in this turn.',
            },
            effect: {
              type: 'create_trip',
              tripId: sessionCreatedTripId,
              openTripId: sessionCreatedTripId,
              summary: 'Trip already created in this request.',
            },
          };
        }
      } else {
        try {
          result = await executeChatTool({
            name: toolCall.function.name,
            args: toolArgs,
            supabase: input.supabase,
            userId: input.userId,
            authHeader: input.authHeader,
            activeTripId: input.activeTripId,
            conversationId,
            conversationTripId: input.conversationTripId ?? input.activeTripId,
            sessionCreatedTripId,
            allowSavedTripCreate: input.allowSavedTripCreate,
            gatheredTripContext: input.gatheredTripContext,
          });
        } catch (toolError) {
          const message = toolError instanceof Error ? toolError.message : 'Tool execution failed';
          result = {
            toolResult: { success: false, error: message },
          };
        }
      }
      if (toolCall.function.name === 'create_trip' && result.toolResult.success) {
        const tripId = result.toolResult.tripId ?? result.effect?.tripId;
        if (typeof tripId === 'string') sessionCreatedTripId = tripId;
      }
      if (toolCall.function.name === 'delete_trip' && result.toolResult.success) {
        const tripId = result.toolResult.tripId ?? result.effect?.tripId ?? toolTripId;
        if (typeof tripId === 'string') sessionDeletedTripIds.add(tripId);
      }
      if (result.effect) effects.push(result.effect);
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        name: toolCall.function.name,
        content: compactJson(result.toolResult),
      });
    }
  }

  return {
    reply:
      'I made the available updates and saved the results. I may need one more detail to continue further.',
    effects,
    openTripId: effects.find((effect) => effect.openTripId)?.openTripId,
    connectedTripId: lastEffectTripId(effects),
  };
}

function buildBaseMessages(input: {
  system: string;
  history: ChatHistoryMessage[];
  message: string;
}): GroqMessage[] {
  const messages: GroqMessage[] = [{ role: 'system', content: input.system }];
  for (const item of input.history) {
    messages.push({ role: item.role, content: trimHistoryMessage(item.content) });
  }
  if (!hasCurrentUserMessage(input.history, input.message)) {
    messages.push({ role: 'user', content: input.message });
  }
  return messages;
}

async function saveAssistantReply(input: {
  supabase: any;
  conversationId?: string;
  reply: string;
  effects: ChatToolEffect[];
  connectedTripId?: string;
  openTripId?: string;
}) {
  if (!input.conversationId) return;
  const cleanedReply = stripRawToolMarkupFromReply(input.reply);
  await safeDb('insert assistant message', async () => {
    const { error } = await input.supabase.from('chat_messages').insert({
      conversation_id: input.conversationId,
      role: 'assistant',
      content: cleanedReply,
      metadata: {
        toolEffects: input.effects,
        tripId: input.connectedTripId,
        openTripId: input.openTripId ?? input.connectedTripId,
      },
    });
    if (error) throw error;

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.connectedTripId) patch.trip_id = input.connectedTripId;
    await input.supabase
      .from('chat_conversations')
      .update(patch)
      .eq('id', input.conversationId);
  });
}

type StreamChatPayload = AssistantRunResult & {
  conversationId?: string;
  title?: string | null;
  warning?: string | null;
};

type SseSend = (obj: Record<string, unknown>) => void;

const SSE_HEADERS: Record<string, string> = {
  ...corsHeaders,
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
};

function emitStreamChatPayload(
  send: SseSend,
  result: StreamChatPayload,
  options?: { skipDeltas?: boolean },
): void {
  if (result.warning) send({ warning: result.warning });

  if (!options?.skipDeltas) {
    const chunks = result.reply.match(/.{1,24}(\s|$)|\S+/g) ?? [result.reply];
    for (const chunk of chunks) {
      if (chunk) {
        send({
          delta: chunk,
          conversationId: result.conversationId,
          openTripId: result.openTripId,
        });
      }
    }
  }

  send({
    done: true,
    conversationId: result.conversationId,
    title: result.title ?? undefined,
    reply: result.reply,
    warning: result.warning,
    openTripId: result.openTripId,
    tripId: result.connectedTripId,
    effects: result.effects,
  });
}

function createChatSseResponse(
  run: (send: SseSend) => Promise<void>,
): Response {
  return new Response(
    new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const send: SseSend = (obj) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        };
        try {
          await run(send);
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Unknown error';
          send({ error: msg });
        }
        controller.close();
      },
    }),
    { headers: SSE_HEADERS },
  );
}

deno.Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return jsonResponse({ error: 'Invalid request body' }, 400);
  }

  const message = body.message?.trim();
  if (!message) {
    return jsonResponse({ error: 'message is required' }, 400);
  }

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  if (body.stream === true) {
    const inFlight = await chatInFlightResponse(auth, body);
    if (inFlight) return inFlight;
    return createChatSseResponse(async (send) => {
      await runChatTurn(req, auth, body, message, send);
    });
  }

  const result = await runChatTurn(req, auth, body, message);
  return result ?? jsonResponse({ error: 'Chat request failed' }, 500);
});

async function chatInFlightResponse(
  auth: { user: { id: string }; supabase: any },
  body: RequestBody,
): Promise<Response | null> {
  const conversationId = body.conversationId;
  const clientRequestId = body.clientRequestId?.trim();
  if (!conversationId || !clientRequestId) return null;

  const inFlight = await safeDb('chat request in flight', () =>
    isChatRequestInFlight({
      supabase: auth.supabase,
      conversationId,
      clientRequestId,
    }),
  );
  if (!inFlight) return null;

  return jsonResponse(
    {
      error: 'Your previous message is still being processed. Please wait a moment.',
      retryable: true,
    },
    409,
  );
}

async function runChatTurn(
  req: Request,
  auth: { user: { id: string }; supabase: any },
  body: RequestBody,
  message: string,
  send?: SseSend,
): Promise<Response | void> {
  let autoPersist: Awaited<ReturnType<typeof maybeAutoPersistTrip>> | null = null;
  let supabase: any = null;
  let userId: string | undefined;
  let conversationId: string | undefined;
  let conversationTitle: string | null = null;
  let dbWarning: string | null = null;
  let isNewConversation = false;
  let streamedLive = false;

  try {
    const groqKey = deno.Deno.env.get('GROQ_API_KEY');
    if (!groqKey) {
      if (send) {
        send({ error: 'GROQ_API_KEY is not set in Supabase Edge Function secrets.' });
        return;
      }
      return jsonResponse(
        { error: 'GROQ_API_KEY is not set in Supabase Edge Function secrets.' },
        500,
      );
    }

    const { user, supabase: authSupabase } = auth;
    userId = user.id;
    supabase = authSupabase;
    const authHeader = req.headers.get('Authorization') ?? '';

    const clientRequestId = body.clientRequestId?.trim() || undefined;
    const onStreamDelta = send
      ? (delta: string) => {
          streamedLive = true;
          send({
            delta,
            conversationId,
            openTripId: undefined,
          });
        }
      : undefined;
    const history = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY_TURNS) : [];

    conversationId = body.conversationId;
    conversationTitle = null;
    dbWarning = null;
    isNewConversation = !conversationId;

    if (!conversationId) {
      conversationTitle = generateConversationTitle(message);
      const conv = await safeDb('create conversation', async () => {
        const { data, error } = await supabase
          .from('chat_conversations')
          .insert({
            user_id: user.id,
            trip_id: body.tripId ?? null,
            title: conversationTitle,
          })
          .select('id')
          .single();
        if (error) throw error;
        return data?.id;
      });
      conversationId = conv ?? undefined;
      if (!conversationId) {
        dbWarning =
          'Chat works, but history is not saved. Run supabase/migrations SQL in your project.';
      }
    }

    if (conversationId && clientRequestId) {
      const replay = await safeDb('idempotent chat replay', () =>
        findChatRequestReplay({ supabase, conversationId: conversationId!, clientRequestId }),
      );
      if (replay) {
        const replayPayload = {
          reply: replay.reply,
          conversationId,
          openTripId: replay.openTripId,
          tripId: replay.connectedTripId,
          effects: replay.effects,
          warning: dbWarning,
          retryable: false,
        };
        if (send) {
          emitStreamChatPayload(send, replayPayload);
          return;
        }
        return jsonResponse(replayPayload);
      }

      if (!send) {
        const inFlight = await safeDb('chat request in flight', () =>
          isChatRequestInFlight({ supabase, conversationId: conversationId!, clientRequestId }),
        );
        if (inFlight) {
          return jsonResponse(
            {
              error: 'Your previous message is still being processed. Please wait a moment.',
              retryable: true,
            },
            409,
          );
        }
      }
    }

    if (conversationId) {
      const shouldInsertUser =
        !clientRequestId ||
        !(await safeDb('chat user message idempotency', async () => {
          const { data, error } = await supabase
            .from('chat_messages')
            .select('id')
            .eq('conversation_id', conversationId)
            .eq('role', 'user')
            .contains('metadata', { clientRequestId })
            .limit(1);
          if (error) throw error;
          return (data?.length ?? 0) > 0;
        }));
      if (shouldInsertUser) {
        await safeDb('insert user message', async () => {
          const { error } = await supabase.from('chat_messages').insert({
            conversation_id: conversationId,
            role: 'user',
            content: message,
            attachments: body.attachments ?? [],
            metadata: clientRequestId ? { clientRequestId } : {},
          });
          if (error) throw error;
        });
      }
    }

    const preMemoryHistory: ChatHistoryMessage[] = history;

    const memory = await buildChatMemoryContext({
      supabase,
      userId: user.id,
      conversationId,
      requestedTripId: body.tripId,
      userMessage: message,
      clientHistory: preMemoryHistory,
      isNewConversation,
    });

    const fullGatheredTrip = buildConversationGatheredContext({
      clientHistory: preMemoryHistory,
      authoritativeHistory: memory.authoritativeHistory,
      currentMessage: message,
      clientTripContext: body.tripContext,
    });
    logTripPersistPipeline('gatheredTripContext', fullGatheredTrip, {
      clientTripContext: body.tripContext ?? null,
    });
    const fullTripRequirements = assessTripRequirements(fullGatheredTrip);
    const canPersist = canPersistTripFromChat(
      message,
      fullGatheredTrip,
      memory.authoritativeHistory,
      memory.activeTrip,
      memory.conversationTripId,
    );
    logTripPersistPipeline('canPersistTripFromChat', fullGatheredTrip, {
      canPersist,
      missingFields: fullTripRequirements.missing,
    });
    const tripContext = fullGatheredTrip;

    let useTools = messageNeedsChatTools(message, {
      activeTripId: memory.activeTripId,
      activeTripStatus: memory.activeTrip?.status,
      gatheredTrip: fullGatheredTrip,
      tripPlanningComplete: fullTripRequirements.complete,
    });
    const chatModel = MODEL_8B;
    const chatMaxTokens = useTools ? 640 : 480;

    const hasLongHistory = memory.authoritativeHistory.length > MAX_HISTORY_TURNS;
    const historyForModel = hasLongHistory
      ? memory.authoritativeHistory.slice(-MAX_HISTORY_TURNS)
      : memory.authoritativeHistory;

    let conversationSummary: string | null = null;
    if (hasLongHistory) {
      // Reuse an existing summary when possible; otherwise generate once and store it.
      if (conversationId) {
        try {
          const { data: summaryRows, error: summaryError } = await supabase
            .from('chat_messages')
            .select('content')
            .eq('conversation_id', conversationId)
            .eq('role', 'system')
            .ilike('content', `${CHAT_SUMMARY_PREFIX}%`)
            .order('created_at', { ascending: false })
            .limit(1);
          if (summaryError) throw summaryError;
          const content = summaryRows?.[0]?.content ?? '';
          if (content.startsWith(CHAT_SUMMARY_PREFIX)) {
            conversationSummary = content.slice(CHAT_SUMMARY_PREFIX.length).trim();
          }
        } catch (summaryLoadError) {
          // If loading fails, we'll fall back to generating a summary on the fly.
          console.warn(
            '[chat] failed to load existing conversation summary:',
            summaryLoadError instanceof Error ? summaryLoadError.message : summaryLoadError,
          );
        }
      }

      if (!conversationSummary) {
        try {
          const toSummarize = memory.authoritativeHistory.slice(
            0,
            memory.authoritativeHistory.length - MAX_HISTORY_TURNS,
          );
          const raw = toSummarize
            .map((m) => `${m.role.toUpperCase()}: ${trimHistoryMessage(m.content)}`)
            .join('\n')
            .slice(0, 4_000);

          const summaryData = await callGroq(
            groqKey,
            [
              {
                role: 'system',
                content:
                  'Summarize this travel-agent chat in ≤120 words. Keep destination, origin, dates, budget INR, travelers, decisions, open questions. Summary only.',
              },
              {
                role: 'user',
                content: `Messages:\n${raw}`,
              },
            ],
            false,
            MODEL_8B,
            200,
            'chat_summary',
            { conversation_id: conversationId, user_id: user.id },
          );

          const summaryText = String(summaryData?.choices?.[0]?.message?.content ?? '').trim();
          if (summaryText) {
            conversationSummary = summaryText;
            if (conversationId) {
              await supabase.from('chat_messages').insert({
                conversation_id: conversationId,
                role: 'system',
                content: `${CHAT_SUMMARY_PREFIX}\n${summaryText}`,
                metadata: { kind: 'conversation_summary' },
              });
            }
          }
        } catch (summaryGenError) {
          console.warn(
            '[chat] conversation summarization failed:',
            summaryGenError instanceof Error
              ? summaryGenError.message
              : summaryGenError,
          );
        }
      }
    }

    // Only fetch live travel data when it is likely to improve the answer for the user’s intent.
    let liveData = '';
    const shouldFetchLiveData = isLikelyToNeedLiveTravelData({
      destination: tripContext.destination,
      message,
      hasActiveTrip: Boolean(memory.activeTripId),
    });

    if (shouldFetchLiveData) {
      const m = message.toLowerCase();
      const weatherOnly = /weather|climate|temperature|rain|clothes|clothing|what to wear/.test(m);
      const wantsHotels = /hotel|hotels|stay|accommodation|where to stay/.test(m);
      const wantsPlaces = /restaurant|food|places|things to do|attraction|sight/.test(m);
      const wantsFlights = /flight|flights/.test(m);
      const wantsTrains = /train|trains/.test(m);
      const wantsBuses = /bus|buses/.test(m);

      try {
        liveData = await buildTravelContext({
          destination: tripContext.destination,
          origin: tripContext.origin,
          startDate: tripContext.startDate,
          endDate: tripContext.endDate,
          budgetInr: tripContext.budgetInr,
          travelers: tripContext.travelers,
          includeHotels: !weatherOnly && wantsHotels,
          includePlaces: !weatherOnly && wantsPlaces,
          includeFlightOffers: wantsFlights,
          includeTrainOffers: wantsTrains,
          includeBusOffers: wantsBuses,
          maxHotels: 4,
          maxPlaces: 5,
          weatherDays: weatherOnly ? 5 : 2,
        });
      } catch (liveError) {
        console.warn(
          '[chat] live travel context failed:',
          liveError instanceof Error ? liveError.message : liveError,
        );
      }
      const LIVE_DATA_MAX = 2_500;
      if (liveData.length > LIVE_DATA_MAX) {
        liveData = `${liveData.slice(0, LIVE_DATA_MAX - 1)}…`;
      }
    }

    const MEMORY_CONTEXT_MAX = 2_800;
    let memoryText = memory.contextText;
    if (memoryText.length > MEMORY_CONTEXT_MAX) {
      memoryText = `${memoryText.slice(0, MEMORY_CONTEXT_MAX - 1)}…`;
    }

    const clientTripContext = formatClientTripContext(tripContext);

    const chatHistory = memory.authoritativeHistory;

    if (memory.activeTripId && messageIsTripsTabNavigationIntent(message)) {
      const tripVisible = await verifyTripSavedForUser(
        supabase,
        user.id,
        memory.activeTripId,
      );
      if (tripVisible) {
        const dest = memory.activeTrip?.destination ?? tripContext.destination ?? 'your trip';
        const tabReply = `Your trip to ${dest} is saved. Open the Trips tab below to view it.`;
        await saveAssistantReply({
          supabase,
          conversationId,
          reply: tabReply,
          effects: [],
          connectedTripId: memory.activeTripId,
          openTripId: memory.activeTripId,
        });
        const tabPayload = {
          reply: tabReply,
          effects: [] as ChatToolEffect[],
          openTripId: memory.activeTripId,
          connectedTripId: memory.activeTripId,
          conversationId,
          title: isNewConversation ? conversationTitle : undefined,
          warning: dbWarning,
        };
        if (send) {
          emitStreamChatPayload(send, tabPayload);
          return;
        }
        return jsonResponse(tabPayload);
      }
    }
    const allowSavedTripCreate = allowSavedTripCreateFromChat(message, fullGatheredTrip);

    console.warn('[chat-persist] turn context', {
      messagePreview: message.slice(0, 80),
      gathered: fullGatheredTrip,
      clientOrigin: body.tripContext?.origin ?? null,
      requirements: fullTripRequirements,
      allowSavedTripCreate,
    });

    const autoDelete = await safeDb('auto delete trip from chat', () =>
      maybeAutoDeleteTrip({
        supabase,
        userId: user.id,
        authHeader,
        message,
        gathered: fullGatheredTrip,
        activeTripId: memory.activeTripId,
        conversationTripId: memory.conversationTripId ?? memory.activeTripId,
      }),
    );
    if (autoDelete?.disableTools) {
      useTools = false;
    }

    autoPersist = await safeDb('auto persist trip from chat', () =>
      maybeAutoPersistTrip({
        supabase,
        userId: user.id,
        authHeader,
        message,
        gathered: fullGatheredTrip,
        history: chatHistory,
        activeTrip: memory.activeTrip,
        activeTripId: memory.activeTripId,
        conversationId,
        conversationTripId: memory.conversationTripId ?? memory.activeTripId,
        sessionCreatedTripId: memory.activeTripId,
      }),
    );
    if (autoPersist?.disableTools) {
      useTools = false;
    }

    const gatheredSection = [
      autoDelete?.contextSection,
      autoPersist?.contextSection,
      formatGatheredTripDetailsSection(fullGatheredTrip, fullTripRequirements),
    ]
      .filter(Boolean)
      .join('\n');

    const systemWithContext = [
      SYSTEM_PROMPT,
      '',
      memoryText,
      `\n${gatheredSection}`,
      clientTripContext ? `\n[CLIENT TRIP CONTEXT]\n${clientTripContext}` : '',
      conversationSummary ? `\n[CONVERSATION SUMMARY]\n${conversationSummary.slice(0, 600)}` : '',
      liveData ? `\n[LIVE TRAVEL DATA]\n${liveData}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    let assistantResult = await runAssistantWithTools({
      groqKey,
      messages: buildBaseMessages({
        system: systemWithContext,
        history: historyForModel,
        message,
      }),
      supabase,
      userId: user.id,
      authHeader,
      model: chatModel,
      maxTokens: chatMaxTokens,
      useTools,
      conversationId,
      activeTripId: memory.activeTripId,
      conversationTripId: autoPersist?.connectedTripId ?? memory.activeTripId,
      allowSavedTripCreate,
      priorCreatedTripId: autoPersist?.connectedTripId,
      gatheredTripContext: fullGatheredTrip,
      onStreamDelta,
    });

    if (autoDelete?.effects.length) {
      assistantResult = {
        ...assistantResult,
        effects: [...autoDelete.effects, ...assistantResult.effects],
        connectedTripId: undefined,
        openTripId: undefined,
      };
    }

    if (autoPersist?.effects.length) {
      assistantResult = {
        ...assistantResult,
        effects: [...autoPersist.effects, ...assistantResult.effects],
        openTripId: autoPersist.openTripId ?? assistantResult.openTripId,
        connectedTripId: autoPersist.connectedTripId ?? assistantResult.connectedTripId,
      };
    }

    const persistedBeforeFinalize = tripWasPersistedFromEffects(assistantResult.effects);
    if (
      !persistedBeforeFinalize.persisted &&
      fullTripRequirements.complete &&
      canPersistTripFromChat(
        message,
        fullGatheredTrip,
        chatHistory,
        memory.activeTrip,
        memory.conversationTripId,
      )
    ) {
      const forcedPersist = await safeDb('retry auto persist trip from chat', () =>
        maybeAutoPersistTrip({
          supabase,
          userId: user.id,
          authHeader,
          message,
          gathered: fullGatheredTrip,
          history: chatHistory,
          activeTrip: memory.activeTrip,
          activeTripId: memory.activeTripId,
          conversationId,
          conversationTripId: memory.conversationTripId ?? memory.activeTripId,
          sessionCreatedTripId:
            assistantResult.connectedTripId ?? memory.activeTripId,
        }),
      );
      if (forcedPersist?.effects.length) {
        assistantResult = {
          ...assistantResult,
          effects: [...forcedPersist.effects, ...assistantResult.effects],
          openTripId: forcedPersist.openTripId ?? assistantResult.openTripId,
          connectedTripId: forcedPersist.connectedTripId ?? assistantResult.connectedTripId,
        };
      }
    }

    const finalizeEffect = await safeDb('finalize trip on confirmation', () =>
      finalizeTripOnUserConfirmation({
        supabase,
        userId: user.id,
        message,
        history: chatHistory,
        gathered: fullGatheredTrip,
        activeTrip: memory.activeTrip,
        effects: assistantResult.effects,
      }),
    );
    if (finalizeEffect) {
      assistantResult = {
        ...assistantResult,
        effects: [...assistantResult.effects, finalizeEffect],
        connectedTripId: finalizeEffect.tripId ?? assistantResult.connectedTripId,
      };
    }

    const connectedTripId = assistantResult.connectedTripId ?? memory.activeTripId;

    const finalized = await finalizeTripPersistResult({
      supabase,
      userId: user.id,
      reply: assistantResult.reply,
      effects: assistantResult.effects,
      gathered: fullGatheredTrip,
      openTripId: assistantResult.openTripId,
      connectedTripId,
    });
    console.warn('[chat-persist] turn result', {
      persisted: finalized.effects.some(
        (e) => (e.type === 'create_trip' || e.type === 'update_trip') && e.tripId,
      ),
      deleted: finalized.effects.some((e) => e.type === 'delete_trip' && e.tripId),
      effectTypes: finalized.effects.map((e) => e.type),
      tripId: finalized.connectedTripId,
    });
    assistantResult = {
      ...assistantResult,
      reply: finalized.reply,
      effects: finalized.effects,
      openTripId: finalized.openTripId,
      connectedTripId: finalized.connectedTripId,
    };

    await saveAssistantReply({
      supabase,
      conversationId,
      reply: assistantResult.reply,
      effects: assistantResult.effects,
      connectedTripId: assistantResult.connectedTripId,
      openTripId: assistantResult.openTripId,
    });

    const responsePayload = {
      ...assistantResult,
      connectedTripId: assistantResult.connectedTripId,
      conversationId,
      title: isNewConversation ? conversationTitle : undefined,
      warning: dbWarning,
    };

    if (send) {
      emitStreamChatPayload(send, responsePayload, { skipDeltas: streamedLive });
      return;
    }

    return jsonResponse({
      reply: assistantResult.reply,
      conversationId,
      title: isNewConversation ? conversationTitle : undefined,
      warning: dbWarning,
      openTripId: assistantResult.openTripId,
      tripId: assistantResult.connectedTripId,
      effects: assistantResult.effects,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    const rateLimited =
      msg === 'RATE_LIMIT_RETRY_EXHAUSTED' || /rate limit|429|tokens per minute/i.test(msg);
    const toolValidationFailed =
      msg === 'TOOL_CALL_VALIDATION_FAILED' ||
      /tool call validation failed/i.test(msg);

    if (autoPersist?.effects.length) {
      const tripId = autoPersist.connectedTripId ?? autoPersist.openTripId;
      const verified =
        typeof tripId === 'string' && supabase
          ? await verifyTripSavedForUser(supabase, userId!, tripId)
          : false;
      if (verified) {
        const partialReply = 'Your trip has been saved. You can view it in the Trips tab.';
        if (supabase && conversationId) {
        await saveAssistantReply({
          supabase,
          conversationId,
          reply: partialReply,
          effects: autoPersist.effects,
          connectedTripId: tripId,
          openTripId: autoPersist.openTripId ?? tripId,
        });
        }
        const partialPayload = {
          reply: partialReply,
          conversationId,
          warning: rateLimited
            ? 'The AI was briefly busy, but your trip was still saved.'
            : undefined,
          openTripId: autoPersist.openTripId ?? tripId,
          tripId,
          effects: autoPersist.effects,
          retryable: false,
        };
        if (send) {
          emitStreamChatPayload(send, {
            ...partialPayload,
            effects: autoPersist.effects,
          });
          return;
        }
        return jsonResponse(partialPayload, 200);
      }
      if (supabase && conversationId) {
        await saveAssistantReply({
          supabase,
          conversationId,
          reply: TRIP_SAVE_FAILURE_REPLY,
          effects: [],
          connectedTripId: undefined,
        });
      }
      const failurePayload = {
        reply: TRIP_SAVE_FAILURE_REPLY,
        conversationId,
        warning: rateLimited
          ? 'The AI was briefly busy and your trip may not have saved. Please try again.'
          : undefined,
        effects: [] as ChatToolEffect[],
        retryable: rateLimited,
      };
      if (send) {
        emitStreamChatPayload(send, {
          reply: TRIP_SAVE_FAILURE_REPLY,
          conversationId,
          warning: failurePayload.warning ?? undefined,
          effects: [],
        });
        return;
      }
      return jsonResponse(failurePayload, rateLimited ? 503 : 500);
    }

    if (rateLimited || toolValidationFailed) {
      const busyError =
        'The AI is briefly busy planning your trip. Please wait a moment and send your message again.';
      if (send) {
        send({ error: busyError, retryable: true });
        return;
      }
      return jsonResponse({ error: busyError, retryable: true }, 503);
    }
    if (send) {
      send({ error: msg });
      return;
    }
    return jsonResponse({ error: msg }, 500);
  }
}
