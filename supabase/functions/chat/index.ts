import { handleOptions, jsonResponse, corsHeaders } from '../_shared/cors.ts';
import { requireUser } from '../_shared/auth.ts';
import { parseBudgetFromText } from '../_shared/currency.ts';
import { CHAT_TRANSPORT_HINT_SHORT } from '../_shared/plan-prompt.ts';
import { buildTravelContext } from '../_shared/travel-apis.ts';
import { logGroqUsage } from '../_shared/groq-usage.ts';
import { safeDb } from '../_shared/db.ts';
import {
  buildChatMemoryContext,
  CHAT_AGENT_TOOLS,
  executeChatTool,
  type ChatHistoryMessage,
  type ChatToolEffect,
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
- Saved trips: use [TRIP MEMORY] and tools only; never invent saved-trip facts.
- Continue from [CHAT MEMORY] and recent messages; ask one short follow-up when details are missing.
- DB changes only via tools; never claim a mutation unless a tool succeeded.
- New full trips need destination, origin, dates/duration, travelers, INR budget (draft OK if requested).
- On create_trip, generatePlan defaults to true — always build itinerary, budget, and packing unless the user explicitly wants a draft-only trip.
- If [CLIENT TRIP CONTEXT] includes origin, use it and do not ask for origin city unless the user wants to change it.
- [LIVE TRAVEL DATA]: weather, named hotels/places, real trains only when present; mark estimates as approximate; no invented train numbers if [AI TRAIN FALLBACK].
${CHAT_TRANSPORT_HINT_SHORT}
Reply in 2–5 short sentences unless the user asks for detail.`;

const CHAT_SUMMARY_PREFIX = 'CHAT_SUMMARY:';

function messageNeedsChatTools(message: string): boolean {
  const m = message.toLowerCase().trim();
  if (m.length < 28 && /^(hi|hello|hey|thanks|thank you|ok|okay|sure|great|cool|good morning|good evening)\b/.test(m)) {
    return false;
  }
  return (
    /\b(create|update|change|edit|regenerate|refresh|save|saved|list|show|open|delete|remove)\b/.test(m) ||
    /\b(my trips?|trip count|how many trips)\b/.test(m) ||
    /\b(plan my trip|create a trip|new trip|add trip|generate plan|make a trip)\b/.test(m) ||
    (/\b(budget|itinerary|packing|hotel|flight|train)\b/.test(m) && /\b(trip|for this|my)\b/.test(m))
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
  tripId?: string;
  attachments?: Array<{ url: string; name: string; type: string }>;
  tripContext?: {
    destination?: string;
    origin?: string;
    startDate?: string;
    endDate?: string;
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

function isWeakDestinationLabel(destination: string): boolean {
  const normalized = destination.trim().toLowerCase();
  return (
    normalized.length < 3 ||
    /^(this|that|there|here)(\s+trip)?$/.test(normalized) ||
    normalized === 'this trip' ||
    normalized === 'the trip'
  );
}

function parseTripContextFromMessage(text: string): RequestBody['tripContext'] {
  const ctx: RequestBody['tripContext'] = {};
  const destMatch = text.match(
    /(?:to|in|visit|trip to|going to)\s+([A-Za-z][A-Za-z\s,]{2,40}?)(?:\s+in\s+|\s+for\s+|\s+with\s+|\.|,|$)/i,
  );
  if (destMatch) {
    const destination = destMatch[1].trim();
    if (!isWeakDestinationLabel(destination)) ctx.destination = destination;
  }

  const budgetInr = parseBudgetFromText(text);
  if (budgetInr != null) ctx.budgetInr = budgetInr;

  const travelersMatch = text.match(/(\d+)\s*(?:people|travelers|travellers|guests|pax|friends?)/i);
  if (travelersMatch) ctx.travelers = Number(travelersMatch[1]);

  const originMatch = text.match(
    /(?:from|flying from|leaving)\s+([A-Za-z][A-Za-z\s]{2,30}?)(?:\s+to\s+|\s+in\s+|\.|,|$)/i,
  );
  if (originMatch) ctx.origin = originMatch[1].trim();

  const isoDate = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (isoDate) ctx.startDate = isoDate[1];

  return ctx;
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
): Promise<Record<string, any>> {
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: 0.5,
    max_tokens: maxTokens,
  };
  if (useTools) {
    body.tools = CHAT_AGENT_TOOLS;
    body.tool_choice = 'auto';
  }

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${groqKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message ?? 'Groq API request failed');
  }
  logGroqUsage(usageLabel, data as Record<string, unknown>, model, usageMeta);
  return data;
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
}): Promise<AssistantRunResult> {
  const messages = [...input.messages];
  const effects: ChatToolEffect[] = [];
  const usageMeta = {
    conversation_id: input.conversationId,
    user_id: input.userId,
  };

  for (let step = 0; step < (input.useTools ? 5 : 1); step += 1) {
    let data: Record<string, any>;
    try {
      data = await callGroq(
        input.groqKey,
        messages,
        input.useTools,
        input.model,
        input.maxTokens,
        input.useTools ? 'chat_tools' : 'chat_reply',
        { ...usageMeta, step },
      );
    } catch (error) {
      if (step > 0) {
        throw error;
      }
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

    const assistantMessage = data?.choices?.[0]?.message ?? {};
    const toolCalls = Array.isArray(assistantMessage.tool_calls)
      ? assistantMessage.tool_calls as GroqToolCall[]
      : [];

    if (!toolCalls.length) {
      const reply = String(assistantMessage.content ?? '').trim();
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
      try {
        result = await executeChatTool({
          name: toolCall.function.name,
          args: parseToolArgs(toolCall.function.arguments),
          supabase: input.supabase,
          userId: input.userId,
          authHeader: input.authHeader,
        });
      } catch (toolError) {
        const message = toolError instanceof Error ? toolError.message : 'Tool execution failed';
        result = {
          toolResult: { success: false, error: message },
        };
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
}) {
  if (!input.conversationId) return;
  await safeDb('insert assistant message', async () => {
    const { error } = await input.supabase.from('chat_messages').insert({
      conversation_id: input.conversationId,
      role: 'assistant',
      content: input.reply,
      metadata: {
        toolEffects: input.effects,
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

function streamReply(
  result: AssistantRunResult & {
    conversationId?: string;
    title?: string | null;
    warning?: string | null;
  },
): Response {
  const streamBody = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (obj: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      if (result.warning) send({ warning: result.warning });

      const chunks = result.reply.match(/.{1,72}(\s|$)/g) ?? [result.reply];
      for (const chunk of chunks) {
        if (chunk) {
          send({
            delta: chunk,
            conversationId: result.conversationId,
            openTripId: result.openTripId,
          });
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
      controller.close();
    },
  });

  return new Response(streamBody, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

deno.Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  try {
    const groqKey = deno.Deno.env.get('GROQ_API_KEY');
    if (!groqKey) {
      return jsonResponse(
        { error: 'GROQ_API_KEY is not set in Supabase Edge Function secrets.' },
        500,
      );
    }

    const auth = await requireUser(req);
    if (auth instanceof Response) return auth;
    const { user, supabase } = auth;
    const authHeader = req.headers.get('Authorization') ?? '';

    const body = (await req.json()) as RequestBody;
    const message = body.message?.trim();
    if (!message) {
      return jsonResponse({ error: 'message is required' }, 400);
    }

    const history = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY_TURNS) : [];
    const stream = body.stream === true;

    let conversationId = body.conversationId;
    let conversationTitle: string | null = null;
    let dbWarning: string | null = null;
    const isNewConversation = !conversationId;

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

    if (conversationId) {
      await safeDb('insert user message', async () => {
        const { error } = await supabase.from('chat_messages').insert({
          conversation_id: conversationId,
          role: 'user',
          content: message,
          attachments: body.attachments ?? [],
        });
        if (error) throw error;
      });
    }

    const memory = await buildChatMemoryContext({
      supabase,
      userId: user.id,
      conversationId,
      requestedTripId: body.tripId,
      userMessage: message,
      clientHistory: conversationId ? [] : history,
    });

    const parsedContext = parseTripContextFromMessage(message);
    const activeTripContext = memory.activeTrip
      ? {
        destination: memory.activeTrip.destination,
        origin: memory.activeTrip.origin_city ?? undefined,
        startDate: memory.activeTrip.start_date ?? undefined,
        endDate: memory.activeTrip.end_date ?? undefined,
        budgetInr: memory.activeTrip.budget_usd ? Number(memory.activeTrip.budget_usd) : undefined,
        travelers: memory.activeTrip.travelers,
      }
      : {};
    const tripContext = {
      ...activeTripContext,
      ...parsedContext,
      ...body.tripContext,
    };

    const chatModel = MODEL_8B;
    const chatMaxTokens = messageNeedsChatTools(message) ? 640 : 480;
    const useTools = messageNeedsChatTools(message);

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

    const systemWithContext = [
      SYSTEM_PROMPT,
      '',
      memoryText,
      clientTripContext ? `\n[CLIENT TRIP CONTEXT]\n${clientTripContext}` : '',
      conversationSummary ? `\n[CONVERSATION SUMMARY]\n${conversationSummary.slice(0, 600)}` : '',
      liveData ? `\n[LIVE TRAVEL DATA]\n${liveData}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const assistantResult = await runAssistantWithTools({
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
    });

    const connectedTripId = assistantResult.connectedTripId ?? memory.activeTripId;

    await saveAssistantReply({
      supabase,
      conversationId,
      reply: assistantResult.reply,
      effects: assistantResult.effects,
      connectedTripId,
    });

    const responsePayload = {
      ...assistantResult,
      connectedTripId,
      conversationId,
      title: isNewConversation ? conversationTitle : undefined,
      warning: dbWarning,
    };

    if (stream) {
      return streamReply(responsePayload);
    }

    return jsonResponse({
      reply: assistantResult.reply,
      conversationId,
      title: isNewConversation ? conversationTitle : undefined,
      warning: dbWarning,
      openTripId: assistantResult.openTripId,
      tripId: connectedTripId,
      effects: assistantResult.effects,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return jsonResponse({ error: msg }, 500);
  }
});
