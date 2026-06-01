import { parseBudgetFromText } from './currency.ts';
import { safeDb } from './db.ts';

type SupabaseClient = {
  from: (table: string) => any;
};

export type ChatHistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type TripSummary = {
  id: string;
  title: string;
  destination: string;
  origin_city: string | null;
  start_date: string | null;
  end_date: string | null;
  travelers: number;
  budget_usd: number | null;
  status: string;
  updated_at: string;
};

type ConversationRow = {
  id: string;
  title: string;
  trip_id: string | null;
};

export type ChatMemoryContext = {
  contextText: string;
  authoritativeHistory: ChatHistoryMessage[];
  activeTripId?: string;
  activeTrip?: TripSummary;
  tripCount: number;
};

export type ChatToolEffect = {
  type: 'read' | 'create_trip' | 'update_trip' | 'regenerate_trip' | 'refresh_travel';
  tripId?: string;
  openTripId?: string;
  summary: string;
};

export type ChatToolExecutionResult = {
  toolResult: Record<string, unknown>;
  effect?: ChatToolEffect;
};

export const CHAT_AGENT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'list_saved_trips',
      description: 'List/count saved trips or search by destination/title.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Optional destination/title/status text to search for.',
          },
          limit: {
            type: 'number',
            description: 'Maximum trips to return. Defaults to 10.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_trip_details',
      description: 'Fetch trip details: budget, itinerary, hotels, flights, packing.',
      parameters: {
        type: 'object',
        properties: {
          tripId: { type: 'string', description: 'Exact trip id when known.' },
          query: {
            type: 'string',
            description: 'Destination/title text when the id is not known.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_trip',
      description: 'Update an existing trip (budget, dates, travelers, origin, destination, status).',
      parameters: {
        type: 'object',
        properties: {
          tripId: { type: 'string' },
          query: {
            type: 'string',
            description: 'Destination/title text to identify the trip if tripId is unknown.',
          },
          title: { type: 'string' },
          destination: { type: 'string' },
          originCity: { type: 'string' },
          startDate: { type: 'string', description: 'ISO date YYYY-MM-DD.' },
          endDate: { type: 'string', description: 'ISO date YYYY-MM-DD.' },
          travelers: { type: 'number' },
          budgetInr: { type: 'number', description: 'Trip budget in INR.' },
          status: {
            type: 'string',
            enum: ['draft', 'upcoming', 'saved', 'completed'],
          },
          rebalanceBudget: {
            type: 'boolean',
            description:
              'When budget changes, proportionally update existing budget categories or create default ones. Defaults to true.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_trip',
      description: 'Create a trip (draft or full plan when details are known).',
      parameters: {
        type: 'object',
        required: ['destination'],
        properties: {
          title: { type: 'string' },
          destination: { type: 'string' },
          originCity: { type: 'string' },
          startDate: { type: 'string', description: 'ISO date YYYY-MM-DD.' },
          endDate: { type: 'string', description: 'ISO date YYYY-MM-DD.' },
          travelers: { type: 'number' },
          budgetInr: { type: 'number' },
          status: {
            type: 'string',
            enum: ['draft', 'upcoming', 'saved', 'completed'],
          },
          generatePlan: {
            type: 'boolean',
            description:
              'Generate itinerary, budget, packing, weather, and destination metadata after creating the trip. Defaults to true; set false only when the user explicitly wants a draft trip without a plan.',
          },
          refreshTravelOptions: {
            type: 'boolean',
            description:
              'Refresh hotels and flights after planning when origin/date details are available.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'regenerate_trip_plan',
      description: 'Regenerate itinerary, budget, and packing for a trip.',
      parameters: {
        type: 'object',
        properties: {
          tripId: { type: 'string' },
          query: {
            type: 'string',
            description: 'Destination/title text to identify the trip if tripId is unknown.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'refresh_trip_travel_options',
      description: 'Refresh saved hotel/flight options for a trip.',
      parameters: {
        type: 'object',
        properties: {
          tripId: { type: 'string' },
          query: {
            type: 'string',
            description: 'Destination/title text to identify the trip if tripId is unknown.',
          },
          hotels: { type: 'boolean' },
          flights: { type: 'boolean' },
        },
      },
    },
  },
] as const;

function truncate(value: string, max = 900): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function inr(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return 'not set';
  return `₹${Math.round(Number(value)).toLocaleString('en-IN')}`;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value.replace(/,/g, ''));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Only accept ISO dates so invalid LLM values do not crash Postgres inserts. */
function sanitizeTripDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const parsed = new Date(`${trimmed}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return trimmed;
}

function parseBudgetChangeTarget(text: string): number | null {
  const amountPattern =
    '(?:₹|rs\\.?\\s*|inr\\s*)?(\\d{1,3}(?:,\\d{2,3})+|\\d{4,7}|\\d+(?:\\.\\d+)?\\s*(?:lakhs?|lac|k))';
  const changeMatch = text.match(
    new RegExp(`(?:from|was|changed\\s+from)\\s+${amountPattern}\\s*(?:to|->)\\s*${amountPattern}`, 'i'),
  );
  if (!changeMatch) return null;
  const target = changeMatch[2];
  return parseBudgetFromText(target) ?? null;
}

function normalize(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tripLine(trip: TripSummary): string {
  const dates = trip.start_date
    ? `${trip.start_date}${trip.end_date ? ` to ${trip.end_date}` : ''}`
    : 'dates TBD';
  return `${trip.title} (${trip.destination}) id=${trip.id}, ${dates}, ${trip.travelers} traveler${trip.travelers === 1 ? '' : 's'}, budget ${inr(asNumber(trip.budget_usd))}, status ${trip.status}`;
}

function scoreTrip(trip: TripSummary, query: string): number {
  const q = normalize(query);
  if (!q) return 0;
  const haystack = normalize(
    `${trip.title} ${trip.destination} ${trip.origin_city ?? ''} ${trip.status}`,
  );
  let score = 0;
  if (normalize(trip.destination) === q) score += 20;
  if (normalize(trip.title) === q) score += 16;
  if (haystack.includes(q)) score += 8;
  for (const token of q.split(' ').filter((part) => part.length > 2)) {
    if (haystack.includes(token)) score += 3;
  }
  return score;
}

function messageTripQuery(message: string): string {
  const destinationMatch = message.match(
    /\b(?:my|the)?\s*([A-Za-z][A-Za-z\s,]{2,40}?)\s+(?:trip|budget|itinerary|hotel|flight|route|plan)\b/i,
  );
  if (destinationMatch) return destinationMatch[1].trim();
  const toMatch = message.match(/\b(?:to|in|for)\s+([A-Za-z][A-Za-z\s,]{2,40}?)(?:\s|$|\.|,)/i);
  if (toMatch) return toMatch[1].trim();
  return message;
}

async function fetchTripSummaries(
  supabase: SupabaseClient,
  userId: string,
): Promise<TripSummary[]> {
  const { data, error } = await supabase
    .from('trips')
    .select('id,title,destination,origin_city,start_date,end_date,travelers,budget_usd,status,updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as TripSummary[];
}

async function resolveTrip(
  supabase: SupabaseClient,
  userId: string,
  args: { tripId?: string; query?: string },
): Promise<{ trip?: TripSummary; error?: string; candidates?: TripSummary[] }> {
  const trips = await fetchTripSummaries(supabase, userId);
  if (args.tripId) {
    const exact = trips.find((trip) => trip.id === args.tripId);
    if (exact) return { trip: exact };
    return { error: 'Trip not found or not owned by this user.' };
  }

  const q = (args.query ?? '').trim();
  if (!q) {
    if (trips.length === 1) return { trip: trips[0] };
    return {
      error: 'I need to know which trip to edit.',
      candidates: trips.slice(0, 5),
    };
  }

  const scored = trips
    .map((trip) => ({ trip, score: scoreTrip(trip, q) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) {
    return {
      error: `No saved trip matched "${q}".`,
      candidates: trips.slice(0, 5),
    };
  }

  const [best, second] = scored;
  if (second && best.score < 12 && best.score - second.score < 3) {
    return {
      error: `More than one trip could match "${q}".`,
      candidates: scored.slice(0, 5).map((item) => item.trip),
    };
  }
  return { trip: best.trip };
}

async function fetchConversation(
  supabase: SupabaseClient,
  userId: string,
  conversationId?: string,
): Promise<ConversationRow | null> {
  if (!conversationId) return null;
  const { data, error } = await supabase
    .from('chat_conversations')
    .select('id,title,trip_id')
    .eq('id', conversationId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as ConversationRow | null) ?? null;
}

async function fetchConversationMessages(
  supabase: SupabaseClient,
  conversationId: string,
  limit = 12,
): Promise<ChatHistoryMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('role,content,created_at')
    .eq('conversation_id', conversationId)
    .in('role', ['user', 'assistant'])
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as Array<{ role: string; content: string }>)
    .reverse()
    .filter((msg): msg is ChatHistoryMessage =>
      (msg.role === 'user' || msg.role === 'assistant') && Boolean(msg.content?.trim())
    )
    .map((msg) => ({ role: msg.role, content: truncate(msg.content, 800) }));
}

async function fetchRecentConversationSnippets(
  supabase: SupabaseClient,
  userId: string,
  currentConversationId?: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('chat_conversations')
    .select('id,title,trip_id,updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(4);
  if (error) throw error;

  const conversations = ((data ?? []) as ConversationRow[]).filter(
    (conv) => conv.id !== currentConversationId,
  );
  const snippets: string[] = [];
  for (const conv of conversations.slice(0, 2)) {
    const messages = await fetchConversationMessages(supabase, conv.id, 3);
    const compact = messages
      .slice(-3)
      .map((msg) => `${msg.role}: ${truncate(msg.content, 160)}`)
      .join(' | ');
    if (compact) snippets.push(`${conv.title}: ${compact}`);
  }
  return snippets;
}

async function fetchTripDetails(
  supabase: SupabaseClient,
  userId: string,
  tripId: string,
): Promise<Record<string, unknown> | null> {
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .eq('user_id', userId)
    .maybeSingle();
  if (tripError) throw tripError;
  if (!trip) return null;

  const [budgetResult, daysResult, hotelsResult, flightsResult, packingResult] = await Promise.all([
    supabase.from('budget_categories').select('*').eq('trip_id', tripId).order('sort_order'),
    supabase.from('itinerary_days').select('*').eq('trip_id', tripId).order('day_number'),
    supabase.from('trip_hotels').select('*').eq('trip_id', tripId).order('created_at').limit(8),
    supabase.from('trip_flights').select('*').eq('trip_id', tripId).order('created_at').limit(8),
    supabase.from('packing_items').select('*').eq('trip_id', tripId).order('sort_order').limit(30),
  ]);
  for (const result of [budgetResult, daysResult, hotelsResult, flightsResult, packingResult]) {
    if (result.error) throw result.error;
  }

  const budget = budgetResult.data;
  const days = daysResult.data;
  const hotels = hotelsResult.data;
  const flights = flightsResult.data;
  const packing = packingResult.data;
  const dayRows = (days ?? []) as Array<{ id: string; day_number: number; title: string | null }>;
  let activities: Array<Record<string, unknown>> = [];
  if (dayRows.length) {
    const { data: activityRows, error: activityError } = await supabase
      .from('itinerary_activities')
      .select('*')
      .in('day_id', dayRows.map((day) => day.id))
      .order('sort_order');
    if (activityError) throw activityError;
    activities = (activityRows ?? []) as Array<Record<string, unknown>>;
  }

  return {
    trip,
    budget: budget ?? [],
    itinerary: dayRows.map((day) => ({
      ...day,
      activities: activities.filter((activity) => activity.day_id === day.id),
    })),
    hotels: hotels ?? [],
    flights: flights ?? [],
    packing: packing ?? [],
  };
}

function tripDetailsText(details: Record<string, unknown> | null): string {
  if (!details) return 'No active trip details loaded.';
  const trip = details.trip as TripSummary & {
    country?: string | null;
    weather_summary?: Record<string, unknown> | null;
  };
  const budgetRows = (details.budget as Array<{ label: string; amount_usd: number }>) ?? [];
  const itinerary = (details.itinerary as Array<{
    day_number: number;
    title: string | null;
    activities: Array<{ activity_time?: string | null; name: string; cost_usd?: number | null }>;
  }>) ?? [];
  const hotels = (details.hotels as Array<{ name: string; price_per_night_usd?: number | null }>) ?? [];
  const flights = (details.flights as Array<{ airline?: string | null; route?: string | null; price_usd?: number | null }>) ?? [];

  const lines = [
    `Active trip: ${tripLine(trip)}${trip.country ? `, country ${trip.country}` : ''}.`,
  ];
  if (budgetRows.length) {
    lines.push(
      `Budget categories: ${budgetRows.map((b) => `${b.label} ${inr(asNumber(b.amount_usd))}`).join('; ')}.`,
    );
  }
  if (itinerary.length) {
    lines.push(
      `Itinerary summary: ${itinerary
        .slice(0, 3)
        .map((day) =>
          `Day ${day.day_number}${day.title ? ` ${day.title}` : ''}: ${
            day.activities.slice(0, 2).map((a) => a.name).join(', ') || 'no activities'
          }`
        )
        .join(' | ')}.`,
    );
  }
  if (hotels.length) {
    lines.push(
      `Saved hotels: ${hotels.slice(0, 3).map((h) => `${h.name} ${inr(asNumber(h.price_per_night_usd))}/night`).join('; ')}.`,
    );
  }
  if (flights.length) {
    lines.push(
      `Saved flights: ${flights.slice(0, 2).map((f) => `${f.airline ?? 'Airline'} ${f.route ?? ''} ${inr(asNumber(f.price_usd))}`).join('; ')}.`,
    );
  }
  return lines.join('\n');
}

function shouldIncludeTripDetails(userMessage: string): boolean {
  const m = userMessage.toLowerCase();
  return (
    /update|change|budget|date|dates|traveler|travellers|itinerary|day|hotel|hotels|flight|flights|train|bus|packing|refresh|regenerate|where to stay|room|accommodation/.test(
      m,
    ) || m.includes('for this trip')
  );
}

export async function buildChatMemoryContext(input: {
  supabase: SupabaseClient;
  userId: string;
  conversationId?: string;
  requestedTripId?: string;
  userMessage: string;
  clientHistory?: ChatHistoryMessage[];
}): Promise<ChatMemoryContext> {
  const { supabase, userId } = input;
  const [conversation, trips] = await Promise.all([
    safeDb('fetch conversation', () => fetchConversation(supabase, userId, input.conversationId)),
    safeDb('fetch trip summaries', () => fetchTripSummaries(supabase, userId)),
  ]);
  const tripRows = trips ?? [];
  const query = messageTripQuery(input.userMessage);
  const scoredMatches = tripRows
    .map((trip) => ({ trip, score: scoreTrip(trip, query) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.trip);
  const activeTripId =
    input.requestedTripId ??
    conversation?.trip_id ??
    scoredMatches[0]?.id;

  const includeTripDetails = shouldIncludeTripDetails(input.userMessage);

  const [history, snippets, details] = await Promise.all([
    input.conversationId
      ? safeDb('fetch persisted chat history', () =>
        fetchConversationMessages(supabase, input.conversationId!, 8)
      )
      : Promise.resolve(null),
    safeDb('fetch cross conversation memory', () =>
      fetchRecentConversationSnippets(supabase, userId, input.conversationId)
    ),
    activeTripId
      ? includeTripDetails
        ? safeDb('fetch active trip details', () => fetchTripDetails(supabase, userId, activeTripId))
        : Promise.resolve(null)
      : Promise.resolve(null),
  ]);

  const authoritativeHistory = history?.length
    ? history
    : (input.clientHistory ?? []).slice(-6).map((msg) => ({
      role: msg.role,
      content: truncate(msg.content, 800),
    }));
  const activeTrip = activeTripId ? tripRows.find((trip) => trip.id === activeTripId) : undefined;

  const sections = [
    '[CHAT MEMORY]',
    authoritativeHistory.length
      ? `Current conversation persisted messages are loaded (${authoritativeHistory.length} recent messages).`
      : 'No persisted current-conversation messages were available; use the client-supplied recent context only.',
    snippets?.length
      ? `Recent cross-conversation snippets:\n${snippets.map((s) => `- ${s}`).join('\n')}`
      : 'No prior cross-conversation snippets found.',
    '',
    '[TRIP MEMORY]',
    `Saved trip count: ${tripRows.length}.`,
    tripRows.length
      ? `Recent saved trips:\n${tripRows.slice(0, 4).map((trip) => `- ${tripLine(trip)}`).join('\n')}`
      : 'The user has no saved trips yet.',
    scoredMatches.length
      ? `Trips matching this message:\n${scoredMatches.slice(0, 3).map((trip) => `- ${tripLine(trip)}`).join('\n')}`
      : 'No saved trip matched the latest message strongly.',
    includeTripDetails
      ? tripDetailsText(details)
      : activeTrip
        ? `Active trip: ${tripLine(activeTrip)}.`
        : tripDetailsText(details),
    '',
    '[TOOLS]',
    'Use tools for saved-trip facts, counts, create/update/regenerate/refresh. Never claim a DB change without tool success.',
  ];

  return {
    contextText: sections.join('\n'),
    authoritativeHistory,
    activeTripId,
    activeTrip,
    tripCount: tripRows.length,
  };
}

async function updateProfileTripStats(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { data: trips } = await supabase
    .from('trips')
    .select('id,country')
    .eq('user_id', userId);
  const tripIds = (trips ?? []).map((trip: { id: string }) => trip.id);
  let aiPlansGenerated = 0;
  if (tripIds.length) {
    const { data: days } = await supabase
      .from('itinerary_days')
      .select('trip_id')
      .in('trip_id', tripIds);
    aiPlansGenerated = new Set((days ?? []).map((day: { trip_id: string }) => day.trip_id)).size;
  }
  const countries = new Set(
    (trips ?? [])
      .map((trip: { country?: string | null }) => trip.country)
      .filter((country: string | null | undefined): country is string => Boolean(country)),
  );
  await supabase
    .from('profiles')
    .update({
      trips_count: trips?.length ?? 0,
      countries_visited: countries.size,
      ai_plans_generated: aiPlansGenerated,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
}

async function rebalanceBudgetCategories(
  supabase: SupabaseClient,
  tripId: string,
  newBudgetInr: number,
): Promise<string> {
  const { data, error } = await supabase
    .from('budget_categories')
    .select('id,label,amount_usd,color,sort_order')
    .eq('trip_id', tripId)
    .order('sort_order');
  if (error) throw error;
  const rows = (data ?? []) as Array<{ id: string; label: string; amount_usd: number }>;
  const oldTotal = rows.reduce((sum, row) => sum + (asNumber(row.amount_usd) ?? 0), 0);
  if (rows.length && oldTotal > 0) {
    const updates = rows.map((row, index) => {
      const amount =
        index === rows.length - 1
          ? newBudgetInr -
            rows.slice(0, -1).reduce(
              (sum, prior) => sum + Math.round(((asNumber(prior.amount_usd) ?? 0) / oldTotal) * newBudgetInr),
              0,
            )
          : Math.round(((asNumber(row.amount_usd) ?? 0) / oldTotal) * newBudgetInr);
      return supabase
        .from('budget_categories')
        .update({ amount_usd: Math.max(0, amount) })
        .eq('id', row.id);
    });
    const results = await Promise.all(updates);
    const updateError = results.find((result: { error?: unknown }) => result.error)?.error;
    if (updateError) throw updateError;
    return `Rebalanced ${rows.length} budget categories from ${inr(oldTotal)} to ${inr(newBudgetInr)}.`;
  }

  const defaults = [
    ['Flights', 0.35, '#EAB308'],
    ['Hotels', 0.30, '#000000'],
    ['Food', 0.15, '#16A34A'],
    ['Activities', 0.10, '#FACC15'],
    ['Transport', 0.07, '#CA8A04'],
    ['Misc', 0.03, '#737373'],
  ] as const;
  const amounts = defaults.map(([, pct]) => Math.round(newBudgetInr * pct));
  amounts[amounts.length - 1] += newBudgetInr - amounts.reduce((sum, amount) => sum + amount, 0);
  const { error: insertError } = await supabase.from('budget_categories').insert(
    defaults.map(([label, , color], index) => ({
      trip_id: tripId,
      label,
      amount_usd: amounts[index],
      color,
      sort_order: index,
    })),
  );
  if (insertError) throw insertError;
  return `Created default budget categories totaling ${inr(newBudgetInr)}.`;
}

async function invokeInternalEdge(
  authHeader: string,
  name: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) {
    return { ok: false, data: { error: 'Supabase edge environment is not configured.' } };
  }
  const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, data };
}

export async function executeChatTool(input: {
  name: string;
  args: Record<string, unknown>;
  supabase: SupabaseClient;
  userId: string;
  authHeader: string;
}): Promise<ChatToolExecutionResult> {
  const { name, args, supabase, userId, authHeader } = input;

  if (name === 'list_saved_trips') {
    const trips = await fetchTripSummaries(supabase, userId);
    const query = String(args.query ?? '').trim();
    const limit = Math.max(1, Math.min(asNumber(args.limit) ?? 10, 25));
    const filtered = query
      ? trips
        .map((trip) => ({ trip, score: scoreTrip(trip, query) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((item) => item.trip)
      : trips;
    return {
      toolResult: {
        success: true,
        totalTripCount: trips.length,
        returnedTripCount: filtered.slice(0, limit).length,
        trips: filtered.slice(0, limit),
      },
      effect: {
        type: 'read',
        summary: `Read ${filtered.slice(0, limit).length} saved trip(s); total count is ${trips.length}.`,
      },
    };
  }

  if (name === 'get_trip_details') {
    const resolved = await resolveTrip(supabase, userId, {
      tripId: typeof args.tripId === 'string' ? args.tripId : undefined,
      query: typeof args.query === 'string' ? args.query : undefined,
    });
    if (!resolved.trip) {
      return {
        toolResult: {
          success: false,
          error: resolved.error,
          candidates: resolved.candidates,
        },
      };
    }
    const details = await fetchTripDetails(supabase, userId, resolved.trip.id);
    return {
      toolResult: { success: true, details },
      effect: {
        type: 'read',
        tripId: resolved.trip.id,
        summary: `Read details for ${resolved.trip.destination}.`,
      },
    };
  }

  if (name === 'update_trip') {
    const query = typeof args.query === 'string' ? args.query : undefined;
    const budgetFromQuery = query
      ? parseBudgetChangeTarget(query) ?? parseBudgetFromText(query)
      : null;
    const resolved = await resolveTrip(supabase, userId, {
      tripId: typeof args.tripId === 'string' ? args.tripId : undefined,
      query,
    });
    if (!resolved.trip) {
      return {
        toolResult: {
          success: false,
          error: resolved.error,
          candidates: resolved.candidates,
        },
      };
    }

    const budgetInr = asNumber(args.budgetInr) ?? budgetFromQuery;
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof args.title === 'string' && args.title.trim()) patch.title = args.title.trim();
    if (typeof args.destination === 'string' && args.destination.trim()) patch.destination = args.destination.trim();
    if (typeof args.originCity === 'string') patch.origin_city = args.originCity.trim() || null;
    if (args.startDate !== undefined) patch.start_date = sanitizeTripDate(args.startDate);
    if (args.endDate !== undefined) patch.end_date = sanitizeTripDate(args.endDate);
    const travelers = asNumber(args.travelers);
    if (travelers != null) patch.travelers = Math.max(1, Math.round(travelers));
    if (budgetInr != null) patch.budget_usd = Math.max(0, budgetInr);
    if (
      typeof args.status === 'string' &&
      ['draft', 'upcoming', 'saved', 'completed'].includes(args.status)
    ) {
      patch.status = args.status;
    }

    const changedFields = Object.keys(patch).filter((key) => key !== 'updated_at');
    if (!changedFields.length) {
      return {
        toolResult: {
          success: false,
          error: 'No valid trip fields were provided to update.',
        },
      };
    }

    const { error } = await supabase
      .from('trips')
      .update(patch)
      .eq('id', resolved.trip.id)
      .eq('user_id', userId);
    if (error) throw error;

    let budgetNote: string | null = null;
    if (budgetInr != null && args.rebalanceBudget !== false) {
      budgetNote = await rebalanceBudgetCategories(supabase, resolved.trip.id, Math.round(budgetInr));
    }

    const details = await fetchTripDetails(supabase, userId, resolved.trip.id);
    return {
      toolResult: {
        success: true,
        tripId: resolved.trip.id,
        changedFields,
        budgetNote,
        details,
      },
      effect: {
        type: 'update_trip',
        tripId: resolved.trip.id,
        summary: `Updated ${resolved.trip.destination}: ${changedFields.join(', ')}${budgetNote ? `; ${budgetNote}` : ''}`,
      },
    };
  }

  if (name === 'create_trip') {
    const destination = String(args.destination ?? '').trim();
    if (!destination) {
      return { toolResult: { success: false, error: 'Destination is required.' } };
    }
    const title = String(args.title ?? '').trim() || destination;
    const budgetInr = asNumber(args.budgetInr);
    const travelers = Math.max(1, Math.round(asNumber(args.travelers) ?? 1));
    const status =
      typeof args.status === 'string' &&
        ['draft', 'upcoming', 'saved', 'completed'].includes(args.status)
        ? args.status
        : 'draft';

    const { data: trip, error } = await supabase
      .from('trips')
      .insert({
        user_id: userId,
        title,
        destination,
        origin_city: typeof args.originCity === 'string' && args.originCity.trim()
          ? args.originCity.trim()
          : null,
        start_date: sanitizeTripDate(args.startDate),
        end_date: sanitizeTripDate(args.endDate),
        travelers,
        budget_usd: budgetInr,
        status,
      })
      .select('*')
      .single();
    if (error) {
      return {
        toolResult: {
          success: false,
          error: error.message ?? 'Could not create trip.',
        },
      };
    }
    await updateProfileTripStats(supabase, userId);

    const tripId = (trip as { id: string }).id;
    const shouldGeneratePlan = args.generatePlan !== false;
    const generation = shouldGeneratePlan
      ? await invokeInternalEdge(authHeader, 'plan-trip', { tripId })
      : null;

    let refresh: Record<string, unknown> | null = null;
    if (args.refreshTravelOptions && generation?.ok !== false) {
      const hotels = await invokeInternalEdge(authHeader, 'travel-search', {
        action: 'hotels',
        tripId,
        destination,
        origin: args.originCity,
        startDate: args.startDate,
        endDate: args.endDate,
        budgetInr,
        travelers,
      });
      let flights: Awaited<ReturnType<typeof invokeInternalEdge>> | null = null;
      if (args.originCity && args.startDate) {
        flights = await invokeInternalEdge(authHeader, 'travel-search', {
          action: 'flights',
          tripId,
          origin: args.originCity,
          destination,
          departDate: args.startDate,
          startDate: args.startDate,
          endDate: args.endDate,
          budgetInr,
          travelers,
        });
      }
      refresh = { hotels: hotels.data, flights: flights?.data ?? null };
    }

    const details = await fetchTripDetails(supabase, userId, tripId);
    return {
      toolResult: {
        success: true,
        trip,
        generation: generation?.data ?? null,
        refresh,
        details,
        openTripId: tripId,
      },
      effect: {
        type: 'create_trip',
        tripId,
        openTripId: tripId,
        summary: `Created trip "${title}" for ${destination}${generation ? ' and requested AI planning' : ''}.`,
      },
    };
  }

  if (name === 'regenerate_trip_plan') {
    const resolved = await resolveTrip(supabase, userId, {
      tripId: typeof args.tripId === 'string' ? args.tripId : undefined,
      query: typeof args.query === 'string' ? args.query : undefined,
    });
    if (!resolved.trip) {
      return {
        toolResult: {
          success: false,
          error: resolved.error,
          candidates: resolved.candidates,
        },
      };
    }
    const generation = await invokeInternalEdge(authHeader, 'plan-trip', {
      tripId: resolved.trip.id,
    });
    await updateProfileTripStats(supabase, userId);
    return {
      toolResult: {
        success: generation.ok,
        tripId: resolved.trip.id,
        result: generation.data,
      },
      effect: {
        type: 'regenerate_trip',
        tripId: resolved.trip.id,
        summary: generation.ok
          ? `Regenerated trip plan for ${resolved.trip.destination}.`
          : `Could not regenerate trip plan for ${resolved.trip.destination}.`,
      },
    };
  }

  if (name === 'refresh_trip_travel_options') {
    const resolved = await resolveTrip(supabase, userId, {
      tripId: typeof args.tripId === 'string' ? args.tripId : undefined,
      query: typeof args.query === 'string' ? args.query : undefined,
    });
    if (!resolved.trip) {
      return {
        toolResult: {
          success: false,
          error: resolved.error,
          candidates: resolved.candidates,
        },
      };
    }
    const trip = resolved.trip;
    const refreshHotels = args.hotels !== false;
    const refreshFlights = args.flights === true || (!args.hotels && args.flights !== false);
    const results: Record<string, unknown> = {};
    if (refreshHotels) {
      results.hotels = (await invokeInternalEdge(authHeader, 'travel-search', {
        action: 'hotels',
        tripId: trip.id,
        destination: trip.destination,
        origin: trip.origin_city,
        startDate: trip.start_date,
        endDate: trip.end_date,
        budgetInr: trip.budget_usd,
        travelers: trip.travelers,
      })).data;
    }
    if (refreshFlights && trip.origin_city && trip.start_date) {
      results.flights = (await invokeInternalEdge(authHeader, 'travel-search', {
        action: 'flights',
        tripId: trip.id,
        origin: trip.origin_city,
        destination: trip.destination,
        departDate: trip.start_date,
        startDate: trip.start_date,
        endDate: trip.end_date,
        budgetInr: trip.budget_usd,
        travelers: trip.travelers,
      })).data;
    }
    return {
      toolResult: { success: true, tripId: trip.id, results },
      effect: {
        type: 'refresh_travel',
        tripId: trip.id,
        summary: `Refreshed ${[
          refreshHotels ? 'hotels' : null,
          refreshFlights ? 'flights' : null,
        ].filter(Boolean).join(' and ')} for ${trip.destination}.`,
      },
    };
  }

  return {
    toolResult: {
      success: false,
      error: `Unknown tool: ${name}`,
    },
  };
}
