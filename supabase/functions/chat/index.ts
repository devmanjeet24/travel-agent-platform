import { handleOptions, jsonResponse, corsHeaders } from '../_shared/cors.ts';
import { requireUser } from '../_shared/auth.ts';
import { parseBudgetFromText } from '../_shared/currency.ts';
import { CHAT_TRANSPORT_HINT } from '../_shared/plan-prompt.ts';
import { buildTravelContext } from '../_shared/travel-apis.ts';
import { safeDb } from '../_shared/db.ts';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `You are a professional AI travel agent for Indian travelers with live context from Open-Meteo (weather), OpenStreetMap (hotels/places), and estimated fares when noted.
Help users plan trips: ask clarifying questions when details are missing (dates, budget in INR, travelers, origin city).
Give practical destination ideas, day-wise outlines, and budget tips. All costs and budgets are in Indian Rupees (INR, ₹).
Use ONLY data in [LIVE TRAVEL DATA] for weather and named hotels. Treat flight/hotel prices marked "estimate" as approximations — never invent booking IDs or live seat availability.
${CHAT_TRANSPORT_HINT}
Be concise, friendly, and actionable.`;

function fallbackTitle(message: string): string {
  const cleaned = message.replace(/\[Attachments:[^\]]+\]/gi, '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'New trip chat';
  const words = cleaned.split(/\s+/).slice(0, 8).join(' ');
  return words.length > 56 ? `${words.slice(0, 53)}…` : words;
}

async function generateConversationTitle(
  groqKey: string,
  message: string,
): Promise<string> {
  const prompt = message.replace(/\[Attachments:[^\]]+\]/gi, '').trim().slice(0, 500);
  if (!prompt) return 'New trip chat';

  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content:
              'Write a short chat title (3–6 words, no quotes) summarizing the user travel question. Reply with title only.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.4,
        max_tokens: 24,
      }),
    });
    const data = await res.json();
    const title = String(data?.choices?.[0]?.message?.content ?? '')
      .replace(/^["']|["']$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (title.length >= 3 && title.length <= 60) return title;
  } catch {
    /* use fallback */
  }
  return fallbackTitle(message);
}

function parseTripContextFromMessage(text: string): RequestBody['tripContext'] {
  const ctx: RequestBody['tripContext'] = {};
  const destMatch = text.match(
    /(?:to|in|visit|trip to|going to)\s+([A-Za-z][A-Za-z\s,]{2,40}?)(?:\s+in\s+|\s+for\s+|\s+with\s+|\.|,|$)/i,
  );
  if (destMatch) ctx.destination = destMatch[1].trim();

  const budgetInr = parseBudgetFromText(text);
  if (budgetInr != null) ctx.budgetInr = budgetInr;

  const travelersMatch = text.match(/(\d+)\s*(?:people|travelers|travellers|guests|pax)/i);
  if (travelersMatch) ctx.travelers = Number(travelersMatch[1]);

  const originMatch = text.match(
    /(?:from|flying from|leaving)\s+([A-Za-z][A-Za-z\s]{2,30}?)(?:\s+to\s+|\s+in\s+|\.|,|$)/i,
  );
  if (originMatch) ctx.origin = originMatch[1].trim();

  const isoDate = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (isoDate) ctx.startDate = isoDate[1];

  return ctx;
}

type ChatMessage = { role: 'user' | 'assistant'; content: string };

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

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  try {
    const groqKey = Deno.env.get('GROQ_API_KEY');
    if (!groqKey) {
      return jsonResponse(
        { error: 'GROQ_API_KEY is not set in Supabase Edge Function secrets.' },
        500,
      );
    }

    const auth = await requireUser(req);
    if (auth instanceof Response) return auth;
    const { user, supabase } = auth;

    const body = (await req.json()) as RequestBody;
    const message = body.message?.trim();
    if (!message) {
      return jsonResponse({ error: 'message is required' }, 400);
    }

    const history = Array.isArray(body.history) ? body.history.slice(-20) : [];
    const stream = body.stream === true;

    const parsedContext = parseTripContextFromMessage(message);
    let tripContext = { ...parsedContext, ...body.tripContext };

    if (body.tripId) {
      const { data: trip, error: tripErr } = await supabase
        .from('trips')
        .select(
          'destination, origin_city, start_date, end_date, budget_usd, travelers',
        )
        .eq('id', body.tripId)
        .eq('user_id', user.id)
        .single();
      if (!tripErr && trip) {
        tripContext = {
          destination: trip.destination,
          origin: trip.origin_city ?? undefined,
          startDate: trip.start_date ?? undefined,
          endDate: trip.end_date ?? undefined,
          budgetInr: trip.budget_usd ? Number(trip.budget_usd) : undefined,
          travelers: trip.travelers,
          ...tripContext,
          destination: tripContext.destination ?? trip.destination,
        };
      }
    }

    const liveData = tripContext?.destination
      ? await buildTravelContext({
          destination: tripContext.destination,
          origin: tripContext.origin,
          startDate: tripContext.startDate,
          endDate: tripContext.endDate,
          budgetInr: tripContext.budgetInr,
          travelers: tripContext.travelers,
        })
      : '';

    const systemWithData = liveData
      ? `${SYSTEM_PROMPT}\n\n[LIVE TRAVEL DATA]\n${liveData}`
      : SYSTEM_PROMPT;

    let conversationId = body.conversationId;
    let conversationTitle: string | null = null;
    let dbWarning: string | null = null;
    const isNewConversation = !conversationId;

    if (!conversationId) {
      conversationTitle = await generateConversationTitle(groqKey, message);
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

    const groqBody = {
      model: MODEL,
      messages: [
        { role: 'system', content: systemWithData },
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: message },
      ],
      temperature: 0.7,
      max_tokens: 2048,
      stream,
    };

    const groqRes = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(groqBody),
    });

    if (!groqRes.ok) {
      const errData = await groqRes.json().catch(() => ({}));
      return jsonResponse(
        { error: errData?.error?.message ?? 'Groq API request failed' },
        groqRes.status,
      );
    }

    if (stream && groqRes.body) {
      const reader = groqRes.body.getReader();
      const decoder = new TextDecoder();
      let fullReply = '';
      let sseBuffer = '';

      const streamBody = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          const send = (obj: Record<string, unknown>) => {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(obj)}\n\n`),
            );
          };

          try {
            if (dbWarning) send({ warning: dbWarning });

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              sseBuffer += decoder.decode(value, { stream: true });
              const parts = sseBuffer.split('\n');
              sseBuffer = parts.pop() ?? '';

              for (const line of parts) {
                const trimmed = line.trim();
                if (!trimmed.startsWith('data:')) continue;
                const payload = trimmed.slice(5).trim();
                if (payload === '[DONE]' || !payload) continue;
                try {
                  const parsed = JSON.parse(payload);
                  const delta = parsed.choices?.[0]?.delta?.content ?? '';
                  if (delta) {
                    fullReply += delta;
                    send({ delta, conversationId });
                  }
                } catch {
                  /* skip */
                }
              }
            }

            const trimmedReply = fullReply.trim();
            if (conversationId && trimmedReply) {
              await safeDb('insert assistant message', async () => {
                const { error } = await supabase.from('chat_messages').insert({
                  conversation_id: conversationId,
                  role: 'assistant',
                  content: trimmedReply,
                });
                if (error) throw error;
                await supabase
                  .from('chat_conversations')
                  .update({ updated_at: new Date().toISOString() })
                  .eq('id', conversationId);
              });
            }

            send({
              done: true,
              conversationId,
              title: isNewConversation ? conversationTitle : undefined,
              reply: trimmedReply,
              warning: dbWarning,
            });
            controller.close();
          } catch (e) {
            const msg = e instanceof Error ? e.message : 'Stream error';
            send({ error: msg });
            controller.close();
          }
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

    const groqData = await groqRes.json();
    const reply = groqData?.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return jsonResponse({ error: 'Empty response from AI' }, 502);
    }

    if (conversationId) {
      await safeDb('insert assistant message', async () => {
        const { error } = await supabase.from('chat_messages').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: reply,
        });
        if (error) throw error;
      });
    }

    return jsonResponse({
      reply,
      conversationId,
      title: isNewConversation ? conversationTitle : undefined,
      warning: dbWarning,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return jsonResponse({ error: msg }, 500);
  }
});
