import { parseBudgetFromText } from './currency.ts';
import { safeDb } from './db.ts';
import {
  insertTripActivityNotifications,
  insertTripDeletedNotification,
} from './trip-notifications.ts';

type SupabaseClient = {
  from: (table: string) => any;
};

export type ChatHistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type GatheredTripContext = {
  destination?: string;
  origin?: string;
  startDate?: string;
  endDate?: string;
  /** Explicit trip length in days when the user stated duration instead of an end date. */
  tripDurationDays?: number;
  budgetInr?: number;
  travelers?: number;
};

export type TripRequirementsAssessment = {
  complete: boolean;
  missing: string[];
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
  /** Trip id linked on the current conversation row, if any. */
  conversationTripId?: string;
  tripCount: number;
};

export type ChatToolEffect = {
  type:
    | 'read'
    | 'create_trip'
    | 'update_trip'
    | 'regenerate_trip'
    | 'refresh_travel'
    | 'delete_trip';
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
      description:
        'Create exactly one saved trip when all required fields are known from the conversation. Never invent dates, duration, budget, or travelers. Prefer [AUTO ACTION] when present; call only if auto-save did not run. Status must be "saved".',
      parameters: {
        type: 'object',
        required: [
          'destination',
          'originCity',
          'startDate',
          'travelers',
          'budgetInr',
        ],
        properties: {
          title: { type: 'string' },
          destination: { type: 'string' },
          originCity: { type: 'string' },
          startDate: { type: 'string', description: 'ISO date YYYY-MM-DD. Must come from the user.' },
          endDate: {
            type: 'string',
            description:
              'ISO date YYYY-MM-DD from the user. Required unless tripDurationDays is provided with startDate.',
          },
          tripDurationDays: {
            type: 'number',
            description:
              'Trip length in days when the user gave duration instead of an end date. Requires startDate; do not invent.',
          },
          travelers: { type: 'number', description: 'Number of travelers stated by the user.' },
          budgetInr: { type: 'number', description: 'Trip budget in INR stated by the user.' },
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
  {
    type: 'function',
    function: {
      name: 'delete_trip',
      description:
        'Permanently delete a saved trip and all related itinerary, budget, and packing data. Use when the user asks to delete, remove, or cancel a trip.',
      parameters: {
        type: 'object',
        properties: {
          tripId: {
            type: 'string',
            description: 'Exact trip id when known (e.g. active trip from context).',
          },
          query: {
            type: 'string',
            description: 'Destination/title text to identify the trip if tripId is unknown.',
          },
        },
      },
    },
  },
] as const;

/** Tools exposed to the Groq API on every tool-enabled turn (validation requires declared tools). */
export function selectChatAgentTools(_opts?: { allowCreateTrip?: boolean }) {
  return CHAT_AGENT_TOOLS;
}

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

const MONTH_NAME_TO_NUMBER: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

function padIsoDatePart(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function toIsoDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${padIsoDatePart(month)}-${padIsoDatePart(day)}`;
}

function inferTripYear(month: number, day: number, explicitYear?: number): number {
  if (explicitYear) return explicitYear;
  const now = new Date();
  let year = now.getUTCFullYear();
  const candidate = Date.UTC(year, month - 1, day);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (candidate < today) year += 1;
  return year;
}

const MONTH_NAME_PATTERN =
  '(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)';

/** "from 15 July 2026 to 22 July 2026" → ISO start/end (primary date extractor). */
export function parseTripDateRangeFromText(text: string): {
  startDate?: string;
  endDate?: string;
} {
  const match = text.match(
    new RegExp(
      `\\b(?:from\\s+)?(\\d{1,2})\\s+${MONTH_NAME_PATTERN}\\.?\\s+(20\\d{2})\\s+to\\s+(\\d{1,2})\\s+${MONTH_NAME_PATTERN}\\.?(?:\\s+(20\\d{2}))?\\b`,
      'i',
    ),
  );
  if (!match) return {};

  const startMonth = MONTH_NAME_TO_NUMBER[match[2].toLowerCase().replace(/\./g, '')];
  const endMonth = MONTH_NAME_TO_NUMBER[match[5].toLowerCase().replace(/\./g, '')];
  const startDay = Number(match[1]);
  const endDay = Number(match[4]);
  const startYear = Number(match[3]);
  const endYear = match[6] ? Number(match[6]) : startYear;
  const startDate = toIsoDate(startYear, startMonth, startDay) ?? undefined;
  const endDate = toIsoDate(endYear, endMonth, endDay) ?? undefined;
  return { startDate, endDate };
}

/** Log parsed vs resolved dates through the trip-save pipeline. */
export function logGatheredTripDatePipeline(
  step: string,
  ctx: GatheredTripContext,
  extra?: Record<string, unknown>,
): void {
  const resolved = resolveGatheredTripDates(ctx);
  console.warn(`[chat-persist] dates ${step}`, {
    startDate: ctx.startDate ?? null,
    endDate: ctx.endDate ?? null,
    tripDurationDays: ctx.tripDurationDays ?? null,
    resolvedStartDate: resolved.startDate ?? null,
    resolvedEndDate: resolved.endDate ?? null,
    ...extra,
  });
}

function isWeakDestinationLabel(destination: string): boolean {
  const normalized = destination.trim().toLowerCase();
  return (
    normalized.length < 3 ||
    /^(this|that|there|here)(\s+trip)?$/.test(normalized) ||
    normalized === 'this trip' ||
    normalized === 'the trip' ||
    /^(?:go|going)\s+to\b/.test(normalized)
  );
}

function sanitizeParsedDestination(destination: string): string {
  return destination
    .replace(/^(?:go\s+to|going\s+to|to)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function originsAlign(stated: string, candidate: string): boolean {
  const statedNorm = normalize(stated);
  const candidateNorm = normalize(candidate);
  if (!statedNorm || !candidateNorm) return false;
  if (statedNorm === candidateNorm) return true;
  if (statedNorm.includes(candidateNorm) || candidateNorm.includes(statedNorm)) return true;
  const statedTokens = statedNorm.split(' ').filter((part) => part.length > 2);
  const candidateTokens = candidateNorm.split(' ').filter((part) => part.length > 2);
  if (!statedTokens.length || !candidateTokens.length) return false;
  const overlap = statedTokens.filter((token) => candidateTokens.includes(token)).length;
  return overlap >= 1;
}

function destinationsAlign(stated: string, candidate: string): boolean {
  const statedNorm = normalize(stated);
  const candidateNorm = normalize(candidate);
  if (!statedNorm || !candidateNorm) return false;
  if (statedNorm === candidateNorm) return true;
  if (statedNorm.includes(candidateNorm) || candidateNorm.includes(statedNorm)) return true;
  const statedTokens = statedNorm.split(' ').filter((part) => part.length > 2);
  const candidateTokens = candidateNorm.split(' ').filter((part) => part.length > 2);
  if (!statedTokens.length || !candidateTokens.length) return false;
  const overlap = statedTokens.filter((token) => candidateTokens.includes(token)).length;
  return overlap >= Math.min(statedTokens.length, candidateTokens.length, 1);
}

/** Key-value trip lines: "destination - Goa", "origin is Delhi", "dates - from 10 June". */
function parseLabeledTripFieldsFromText(text: string): GatheredTripContext {
  const ctx: GatheredTripContext = {};

  const destLabel = text.match(/\bdestination\s*[-–:]\s*([^,.\n]+)/i);
  if (destLabel) {
    const candidate = sanitizeParsedDestination(destLabel[1].trim());
    if (!isWeakDestinationLabel(candidate)) ctx.destination = candidate;
  }

  const originLabel = text.match(/\borigin\s*(?:city\s*)?(?:is|-–:)\s*([^,.\n]+)/i);
  if (originLabel) {
    const origin = originLabel[1].trim().replace(/\s+/g, ' ');
    if (origin.length >= 2) ctx.origin = origin;
  }

  const originIsPhrase = text.match(
    /\b([A-Za-z][A-Za-z\s]{2,40}?)\s+is\s+the\s+origin\s+city\b/i,
  );
  if (originIsPhrase) {
    const origin = originIsPhrase[1].trim().replace(/\s+/g, ' ');
    if (origin.length >= 2) ctx.origin = origin;
  }

  const travelersLabel = text.match(
    /(\d+)\s*(?:people|travelers|travellers|guests|pax|friends?|adults?)\b/i,
  );
  if (travelersLabel) ctx.travelers = Number(travelersLabel[1]);

  const budgetExplicit = text.match(/\b(?:we\s+have\s+)?(\d{1,3}(?:,\d{2,3})+|\d{5,7})\s*budget\b/i);
  if (budgetExplicit) {
    ctx.budgetInr = Number(budgetExplicit[1].replace(/,/g, ''));
  }

  const datesLabel = text.match(
    /\bdates?\s*[-–:]\s*(?:from\s+)?(\d{1,2})(?:\s*(?:to|-|–)\s*(\d{1,2}))?\s*(?:of\s+)?(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\.?(\s+(20\d{2}))?/i,
  );
  if (datesLabel) {
    const month = MONTH_NAME_TO_NUMBER[datesLabel[3].toLowerCase().replace(/\./g, '')];
    const startDay = Number(datesLabel[1]);
    const year = inferTripYear(
      month,
      startDay,
      datesLabel[4] ? Number(datesLabel[4].trim()) : undefined,
    );
    const startIso = toIsoDate(year, month, startDay);
    if (startIso) ctx.startDate = startIso;
    if (datesLabel[2]) {
      const endIso = toIsoDate(
        datesLabel[4] ? Number(datesLabel[4].trim()) : year,
        month,
        Number(datesLabel[2]),
      );
      if (endIso) ctx.endDate = endIso;
    }
  }

  return ctx;
}

/** Best-effort extraction from natural-language chat (current + prior user turns). */
export function parseTripContextFromText(text: string): GatheredTripContext {
  const labeled = parseLabeledTripFieldsFromText(text);
  const ctx: GatheredTripContext = { ...labeled };
  const dateRange = parseTripDateRangeFromText(text);
  if (dateRange.startDate) ctx.startDate = dateRange.startDate;
  if (dateRange.endDate) ctx.endDate = dateRange.endDate;
  const destPatterns = [
    /\bplanning\s+a\s+trip\s+to\s+([A-Za-z][A-Za-z\s,]{2,50}?)(?:\s+with\b|\s+for\b|\s+we\b|\.|$)/i,
    /\bplan(?:ning)?\s+to\s+go(?:\s+to)?\s+([A-Za-z][A-Za-z\s,]{2,50}?)(?:\s+with\b|\s+for\b|,|\s+we\b|\s+from\b|\s+and\b|\.|$)/i,
    /\b(?:going\s+to|travel\s+to|visit)\s+([A-Za-z][A-Za-z\s,]{2,50}?)(?:\s+with\b|\s+for\b|,|\s+we\b|\.|$)/i,
    /\btrip\s+to\s+([A-Za-z][A-Za-z\s,]{2,50}?)(?:\s+with\b|\s+for\b|,|\s+we\b|\.|$)/i,
    /(?:^|[,.]\s*)(?:to|in)\s+([A-Za-z][A-Za-z\s,]{2,40}?)(?:\s+in\s+|\s+for\s+|\s+with\s+|\.|,|$)/i,
  ];
  let destination: string | undefined;
  for (const pattern of destPatterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const candidate = sanitizeParsedDestination(match[1].trim());
    if (!isWeakDestinationLabel(candidate)) {
      destination = candidate;
      break;
    }
  }
  if (destination) ctx.destination = destination;

  const travelersMatch = text.match(
    /(\d+)\s*(?:people|travelers|travellers|guests|pax|friends?|adults?)/i,
  );
  if (travelersMatch) ctx.travelers = Number(travelersMatch[1]);

  const budgetInr = parseBudgetFromText(text, { travelers: ctx.travelers });
  if (budgetInr != null) ctx.budgetInr = budgetInr;

  const originMatch = text.match(
    /(?:from|flying from|leaving)\s+([A-Za-z][A-Za-z\s]{2,30}?)(?:\s+to\s+|\s+in\s+|\.|,|$)/i,
  );
  if (originMatch) ctx.origin = originMatch[1].trim();

  const trimmed = text.trim();
  if (!ctx.origin && trimmed.length > 2 && trimmed.length < 56) {
    const transportOnly = /^(flight|flights|train|trains|bus|buses|road|car)$/i.test(trimmed);
    const bareCity = trimmed.match(/^([A-Za-z][A-Za-z\s]{2,40}?)(?:\s+India)?$/i);
    if (!transportOnly && bareCity && !/\d{4,}/.test(trimmed)) {
      ctx.origin = bareCity[1].trim();
    }
  }

  const isoDates = [...text.matchAll(/\b(20\d{2}-\d{2}-\d{2})\b/g)].map((match) => match[1]);
  if (isoDates[0]) ctx.startDate = isoDates[0];
  if (isoDates[1]) ctx.endDate = isoDates[1];

  const dmyMatch = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]);
    const year = Number(dmyMatch[3]);
    const iso = toIsoDate(year, month, day);
    if (iso) ctx.startDate = iso;
  }

  const monthName =
    '(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)';

  const dayMonthYearRangeMatch = !ctx.startDate
    ? text.match(
      new RegExp(
        `\\b(?:from\\s+)?(\\d{1,2})\\s+${monthName}\\.?\\s+(20\\d{2})\\s+to\\s+(\\d{1,2})\\s+${monthName}\\.?(?:\\s+(20\\d{2}))?\\b`,
        'i',
      ),
    )
    : null;
  if (dayMonthYearRangeMatch) {
    const startMonth = MONTH_NAME_TO_NUMBER[dayMonthYearRangeMatch[2].toLowerCase().replace(/\./g, '')];
    const endMonth = MONTH_NAME_TO_NUMBER[dayMonthYearRangeMatch[5].toLowerCase().replace(/\./g, '')];
    const startDay = Number(dayMonthYearRangeMatch[1]);
    const endDay = Number(dayMonthYearRangeMatch[4]);
    const startYear = Number(dayMonthYearRangeMatch[3]);
    const endYear = dayMonthYearRangeMatch[6]
      ? Number(dayMonthYearRangeMatch[6])
      : startYear;
    const startIso = toIsoDate(startYear, startMonth, startDay);
    const endIso = toIsoDate(endYear, endMonth, endDay);
    if (startIso) ctx.startDate = startIso;
    if (endIso) ctx.endDate = endIso;
  }

  const dayMonthRangeMatch = !ctx.startDate
    ? text.match(
      new RegExp(
        `\\b(?:from\\s+)?(\\d{1,2})\\s+${monthName}\\.?\\s+to\\s+(\\d{1,2})\\s+${monthName}\\.?(?:,?\\s*(20\\d{2}))?\\b`,
        'i',
      ),
    ) ??
      text.match(
        new RegExp(
          `\\b(\\d{1,2})\\s+of\\s+${monthName}\\.?\\s+to\\s+(\\d{1,2})\\s+of\\s+${monthName}\\.?(?:,?\\s*(20\\d{2}))?\\b`,
          'i',
        ),
      )
    : null;
  if (dayMonthRangeMatch) {
    const startMonth = MONTH_NAME_TO_NUMBER[dayMonthRangeMatch[2].toLowerCase().replace(/\./g, '')];
    const endMonth = MONTH_NAME_TO_NUMBER[dayMonthRangeMatch[4].toLowerCase().replace(/\./g, '')];
    const startDay = Number(dayMonthRangeMatch[1]);
    const endDay = Number(dayMonthRangeMatch[3]);
    const year = inferTripYear(
      startMonth,
      startDay,
      dayMonthRangeMatch[5] ? Number(dayMonthRangeMatch[5]) : undefined,
    );
    const startIso = toIsoDate(year, startMonth, startDay);
    const endIso = toIsoDate(
      dayMonthRangeMatch[5] ? Number(dayMonthRangeMatch[5]) : year,
      endMonth,
      endDay,
    );
    if (startIso) ctx.startDate = startIso;
    if (endIso) ctx.endDate = endIso;
  }

  const dayOfMonthRangeMatch = !ctx.startDate
    ? text.match(
      new RegExp(
        `\\b(\\d{1,2})\\s+of\\s+${monthName}\\.?\\s+to\\s+(\\d{1,2})\\s+of\\s+${monthName}\\.?(?:,?\\s*(20\\d{2}))?\\b`,
        'i',
      ),
    )
    : null;
  if (dayOfMonthRangeMatch) {
    const startMonth = MONTH_NAME_TO_NUMBER[dayOfMonthRangeMatch[2].toLowerCase().replace(/\./g, '')];
    const endMonth = MONTH_NAME_TO_NUMBER[dayOfMonthRangeMatch[4].toLowerCase().replace(/\./g, '')];
    const startDay = Number(dayOfMonthRangeMatch[1]);
    const endDay = Number(dayOfMonthRangeMatch[3]);
    const year = inferTripYear(
      startMonth,
      startDay,
      dayOfMonthRangeMatch[5] ? Number(dayOfMonthRangeMatch[5]) : undefined,
    );
    const startIso = toIsoDate(year, startMonth, startDay);
    const endIso = toIsoDate(
      dayOfMonthRangeMatch[5] ? Number(dayOfMonthRangeMatch[5]) : year,
      endMonth,
      endDay,
    );
    if (startIso) ctx.startDate = startIso;
    if (endIso) ctx.endDate = endIso;
  }

  const monthRangeMatch = !ctx.startDate
    ? text.match(
      /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\.?\s+(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})(?:,?\s*(20\d{2}))?\b/i,
    )
    : null;
  if (monthRangeMatch) {
    const month = MONTH_NAME_TO_NUMBER[monthRangeMatch[1].toLowerCase().replace(/\./g, '')];
    const startDay = Number(monthRangeMatch[2]);
    const endDay = Number(monthRangeMatch[3]);
    const year = inferTripYear(month, startDay, monthRangeMatch[4] ? Number(monthRangeMatch[4]) : undefined);
    const startIso = toIsoDate(year, month, startDay);
    const endIso = toIsoDate(year, month, endDay);
    if (startIso) ctx.startDate = startIso;
    if (endIso) ctx.endDate = endIso;
  }

  const monthOnlyMatch = text.match(
    /\b(?:in|during|for)\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\.?(\s+(20\d{2}))?\b/i,
  );
  if (monthOnlyMatch && !ctx.startDate) {
    const month = MONTH_NAME_TO_NUMBER[monthOnlyMatch[1].toLowerCase().replace(/\./g, '')];
    if (month) {
      const year = inferTripYear(
        month,
        1,
        monthOnlyMatch[2] ? Number(monthOnlyMatch[2].trim()) : undefined,
      );
      const startIso = toIsoDate(year, month, 1);
      if (startIso) ctx.startDate = startIso;
    }
  }

  const durationMatch = text.match(/\b(?:for\s+)?(\d{1,3})\s+days?\b/i);
  if (durationMatch) {
    ctx.tripDurationDays = Math.max(1, Number(durationMatch[1]));
  }
  if (ctx.tripDurationDays && ctx.startDate && !ctx.endDate) {
    const start = new Date(`${ctx.startDate}T00:00:00Z`);
    if (!Number.isNaN(start.getTime())) {
      const end = new Date(start.getTime() + Math.max(1, ctx.tripDurationDays - 1) * 86_400_000);
      ctx.endDate = end.toISOString().slice(0, 10);
    }
  }

  return mergeGatheredTripContext(labeled, ctx);
}

export function mergeGatheredTripContext(
  ...sources: Array<GatheredTripContext | undefined | null>
): GatheredTripContext {
  const merged: GatheredTripContext = {};
  for (const source of sources) {
    if (!source) continue;
    if (source.destination?.trim()) merged.destination = source.destination.trim();
    if (source.origin?.trim()) merged.origin = source.origin.trim();
    if (source.startDate?.trim()) merged.startDate = source.startDate.trim();
    if (source.endDate?.trim()) merged.endDate = source.endDate.trim();
    if (source.tripDurationDays != null && Number.isFinite(source.tripDurationDays)) {
      merged.tripDurationDays = Math.max(1, Math.round(source.tripDurationDays));
    }
    if (source.budgetInr != null && Number.isFinite(source.budgetInr)) {
      merged.budgetInr = source.budgetInr;
    }
    if (source.travelers != null && Number.isFinite(source.travelers)) {
      merged.travelers = Math.max(1, Math.round(source.travelers));
    }
  }
  return merged;
}

/** Extract trip fields the assistant echoed in a confirmation summary. */
function parseTripContextFromAssistantText(text: string): GatheredTripContext {
  const ctx: GatheredTripContext = {};
  const dest = text.match(
    /\bdestination[:\s]+([A-Za-z][A-Za-z\s,]{2,40}?)(?:\.|,|\n|are\s+correct|is\s+correct|$)/i,
  );
  if (dest) {
    const candidate = sanitizeParsedDestination(dest[1].trim());
    if (!isWeakDestinationLabel(candidate)) ctx.destination = candidate;
  }
  const origin = text.match(
    /\borigin(?:\s+city)?[:\s]+([A-Za-z][A-Za-z\s,]{2,40}?)(?:\.|,|\n|and\s+destination|are\s+correct|$)/i,
  );
  if (origin) {
    const city = origin[1].trim().replace(/\s+/g, ' ');
    if (city.length >= 2) ctx.origin = city;
  }
  const start = text.match(/\bstart\s+date[:\s]+([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?)/i);
  const end = text.match(/\bend\s+date[:\s]+([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?)/i);
  if (start) {
    const parsed = parseTripContextFromText(`trip on ${start[1]}`);
    if (parsed.startDate) ctx.startDate = parsed.startDate;
  }
  if (end) {
    const parsed = parseTripContextFromText(`trip on ${end[1]}`);
    if (parsed.startDate) ctx.endDate = parsed.startDate;
  }
  const budget = text.match(/\bbudget[:\s]+₹?\s*(\d{1,3}(?:,\d{2,3})+|\d{5,7})/i);
  if (budget) ctx.budgetInr = Number(budget[1].replace(/,/g, ''));
  const travelers = text.match(/\b(\d+)\s+travelers?\b/i);
  if (travelers) ctx.travelers = Number(travelers[1]);
  return ctx;
}

export function gatherTripContextFromHistory(
  history: ChatHistoryMessage[],
): GatheredTripContext {
  let merged: GatheredTripContext = {};
  for (const item of history) {
    const parsed = item.role === 'user'
      ? parseTripContextFromText(item.content)
      : parseTripContextFromAssistantText(item.content);
    merged = mergeGatheredTripContext(merged, parsed);
  }
  return merged;
}

function computeTripEndDateFromStartAndDuration(
  startDate: string,
  tripDurationDays: number,
): string | null {
  const start = new Date(`${startDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) return null;
  const days = Math.max(1, Math.round(tripDurationDays));
  const end = new Date(start.getTime() + (days - 1) * 86_400_000);
  return end.toISOString().slice(0, 10);
}

export function resolveGatheredTripDates(
  ctx: GatheredTripContext,
): { startDate?: string; endDate?: string } {
  const startDate = ctx.startDate?.trim();
  const endDate = ctx.endDate?.trim();
  if (startDate && endDate) return { startDate, endDate };
  if (startDate && ctx.tripDurationDays != null && Number.isFinite(ctx.tripDurationDays)) {
    const computedEnd = computeTripEndDateFromStartAndDuration(startDate, ctx.tripDurationDays);
    if (computedEnd) return { startDate, endDate: computedEnd };
  }
  return { startDate, endDate };
}

/** Resolve create_trip args to concrete ISO start/end (duration is never stored on the trip row). */
export function resolveCreateTripDatesFromArgs(
  args: Record<string, unknown>,
): { startDate?: string; endDate?: string } {
  const startDate = sanitizeTripDate(args.startDate) ?? undefined;
  let endDate = sanitizeTripDate(args.endDate) ?? undefined;
  const duration = asNumber(args.tripDurationDays);
  if (startDate && !endDate && duration != null && duration >= 1) {
    endDate = computeTripEndDateFromStartAndDuration(startDate, duration) ?? undefined;
  }
  return { startDate, endDate };
}

function tripCreateArgsMatchGathered(
  args: Record<string, unknown>,
  gathered: GatheredTripContext,
): { ok: boolean; missing: string[]; error?: string } {
  const assessment = assessTripRequirements(gathered);
  if (!assessment.complete) {
    return {
      ok: false,
      missing: assessment.missing,
      error:
        `Cannot create trip yet. Still missing from conversation: ${assessment.missing.join(', ')}. Ask the user before calling create_trip.`,
    };
  }

  const argDates = resolveCreateTripDatesFromArgs(args);
  const gatheredDates = resolveGatheredTripDates(gathered);
  const missing: string[] = [];

  const destination = String(args.destination ?? '').trim();
  if (!destination || isWeakDestinationLabel(destination)) {
    missing.push('destination');
  } else if (!destinationsAlign(gathered.destination ?? '', destination)) {
    return {
      ok: false,
      missing: ['destination'],
      error: 'Destination must match what the user stated in this conversation.',
    };
  }

  const originCity = typeof args.originCity === 'string' ? args.originCity.trim() : '';
  if (!originCity) {
    missing.push('origin city');
  } else if (!originsAlign(gathered.origin ?? '', originCity)) {
    return {
      ok: false,
      missing: ['origin city'],
      error: 'Origin city must match what the user stated in this conversation.',
    };
  }

  if (!argDates.startDate) missing.push('start date');
  if (!argDates.endDate) {
    missing.push('end date or trip duration (with start date)');
  } else if (
    argDates.startDate !== gatheredDates.startDate ||
    argDates.endDate !== gatheredDates.endDate
  ) {
    return {
      ok: false,
      missing: ['travel dates'],
      error:
        'Trip dates must match the dates or duration the user gave. Never invent dates, assume duration, or auto-generate a trip length (e.g. 15 days).',
    };
  }

  const budgetInr = asNumber(args.budgetInr);
  if (budgetInr == null || !Number.isFinite(budgetInr) || budgetInr <= 0) {
    missing.push('INR budget');
  } else if (
    gathered.budgetInr == null ||
    Math.round(budgetInr) !== Math.round(gathered.budgetInr)
  ) {
    return {
      ok: false,
      missing: ['INR budget'],
      error: 'Budget must match the INR amount the user stated in this conversation.',
    };
  }

  const travelers = asNumber(args.travelers);
  if (travelers == null || !Number.isFinite(travelers) || travelers < 1) {
    missing.push('traveler count');
  } else if (
    gathered.travelers == null ||
    Math.round(travelers) !== Math.round(gathered.travelers)
  ) {
    return {
      ok: false,
      missing: ['traveler count'],
      error: 'Traveler count must match what the user stated in this conversation.',
    };
  }

  if (missing.length) {
    return {
      ok: false,
      missing,
      error: `Cannot create trip yet. Missing: ${missing.join(', ')}. Ask the user for these before calling create_trip.`,
    };
  }

  return { ok: true, missing: [] };
}

export function validateTripCreateArgs(
  args: Record<string, unknown>,
  opts?: { allowSavedTripCreate?: boolean; gathered?: GatheredTripContext },
): { valid: boolean; missing: string[]; error?: string } {
  const missing: string[] = [];
  const destination = String(args.destination ?? '').trim();
  if (!destination || isWeakDestinationLabel(destination)) missing.push('destination');

  const originCity = typeof args.originCity === 'string' ? args.originCity.trim() : '';
  if (!originCity) missing.push('origin city');

  const { startDate, endDate } = resolveCreateTripDatesFromArgs(args);
  if (!startDate) missing.push('start date');
  if (!endDate) {
    missing.push(
      sanitizeTripDate(args.startDate) && asNumber(args.tripDurationDays)
        ? 'valid end date (from trip duration)'
        : 'end date or trip duration (with start date)',
    );
  }

  const budgetInr = asNumber(args.budgetInr);
  if (budgetInr == null || !Number.isFinite(budgetInr) || budgetInr <= 0) {
    missing.push('INR budget');
  }

  const travelers = asNumber(args.travelers);
  if (travelers == null || !Number.isFinite(travelers) || travelers < 1) {
    missing.push('traveler count');
  }

  if (missing.length) {
    return {
      valid: false,
      missing,
      error: `Cannot create trip yet. Missing: ${missing.join(', ')}. Ask the user for these before calling create_trip.`,
    };
  }

  if (!opts?.gathered) {
    return {
      valid: false,
      missing: ['conversation trip details'],
      error:
        'Cannot create trip until destination, origin, dates or duration, travelers, and INR budget are collected from the user in this conversation.',
    };
  }

  const gatheredCheck = tripCreateArgsMatchGathered(args, opts.gathered);
  if (!gatheredCheck.ok) {
    return {
      valid: false,
      missing: gatheredCheck.missing,
      error: gatheredCheck.error,
    };
  }

  if (!opts?.allowSavedTripCreate) {
    return {
      valid: false,
      missing: ['explicit user confirmation'],
      error:
        'Cannot create a trip yet. Collect destination, origin, dates or duration, travelers, and INR budget from the user before calling create_trip.',
    };
  }

  return { valid: true, missing: [] };
}

export function assessTripRequirements(ctx: GatheredTripContext): TripRequirementsAssessment {
  const missing: string[] = [];
  const destination = ctx.destination?.trim() ?? '';
  if (!destination || isWeakDestinationLabel(destination)) missing.push('destination');
  if (!ctx.origin?.trim()) missing.push('origin city');
  const dates = resolveGatheredTripDates(ctx);
  if (!dates.startDate?.trim()) missing.push('start date');
  if (!dates.endDate?.trim()) {
    missing.push(ctx.startDate?.trim() ? 'end date or trip duration' : 'travel dates or trip duration');
  }
  if (ctx.budgetInr == null || !Number.isFinite(ctx.budgetInr) || ctx.budgetInr <= 0) {
    missing.push('INR budget');
  }
  if (ctx.travelers == null || !Number.isFinite(ctx.travelers) || ctx.travelers < 1) {
    missing.push('traveler count');
  }
  return { complete: missing.length === 0, missing };
}

function formatTripDatesOrDurationLabel(ctx: GatheredTripContext): string {
  const dates = resolveGatheredTripDates(ctx);
  if (dates.startDate && dates.endDate) {
    if (ctx.tripDurationDays != null && !ctx.endDate?.trim()) {
      return `${dates.startDate} (${ctx.tripDurationDays} days)`;
    }
    return `${dates.startDate} to ${dates.endDate}`;
  }
  if (dates.startDate) return dates.startDate;
  if (ctx.tripDurationDays != null) return `${ctx.tripDurationDays} days`;
  return 'not set';
}

/** Canonical confirmation summary the assistant must show before saving. */
export function formatTripConfirmationSummary(ctx: GatheredTripContext): string {
  return [
    `Destination: ${ctx.destination ?? 'not set'}`,
    `Origin: ${ctx.origin ?? 'not set'}`,
    `Dates/Duration: ${formatTripDatesOrDurationLabel(ctx)}`,
    `Travelers: ${ctx.travelers ?? 'not set'}`,
    `Budget: ${inr(ctx.budgetInr)}`,
  ].join('\n');
}

export function assistantPresentedTripSummaryInHistory(
  history: ChatHistoryMessage[],
): boolean {
  for (const item of history) {
    if (item.role !== 'assistant') continue;
    const text = item.content;
    const lower = text.toLowerCase();
    const hasDestination = /\bdestination\b/i.test(text) || /\btrip to\b/i.test(lower);
    const hasOrigin = /\borigin\b/i.test(text) || /\bfrom\b/i.test(lower);
    const hasTravelers = /\b(traveler|traveller|people|guests)\b/i.test(text);
    const hasBudget = /\bbudget\b/i.test(text) || /₹|inr/i.test(text);
    const hasDates =
      /\b(date|duration|start|end|days)\b/i.test(text) || /\b20\d{2}-\d{2}-\d{2}\b/.test(text);
    const asksConfirm =
      /\b(confirm|confirmation|look(?:s)? correct|save (?:this|the) trip|approve|does this)\b/i.test(
        text,
      );
    if (hasDestination && hasOrigin && hasTravelers && hasBudget && hasDates && asksConfirm) {
      return true;
    }
  }
  return false;
}

export function formatTripConfirmationPendingSection(
  ctx: GatheredTripContext,
  summaryPresented: boolean,
): string | null {
  if (!assessTripRequirements(ctx).complete) return null;
  if (summaryPresented) {
    return [
      '[TRIP CONFIRMATION]',
      'A confirmation summary was already shown in this thread. Wait for explicit user approval before create_trip.',
    ].join('\n');
  }
  return [
    '[TRIP CONFIRMATION REQUIRED]',
    'Present this exact summary to the user, then ask them to confirm before saving:',
    formatTripConfirmationSummary(ctx),
    'Do not call create_trip or say the trip is saved until they confirm.',
  ].join('\n');
}

export function formatGatheredTripDetailsSection(
  ctx: GatheredTripContext,
  assessment?: TripRequirementsAssessment,
): string {
  const status = assessment ?? assessTripRequirements(ctx);
  const resolvedDates = resolveGatheredTripDates(ctx);
  const known: string[] = [];
  if (ctx.destination) known.push(`destination=${ctx.destination}`);
  if (ctx.origin) known.push(`origin=${ctx.origin}`);
  if (resolvedDates.startDate) known.push(`start=${resolvedDates.startDate}`);
  if (resolvedDates.endDate) known.push(`end=${resolvedDates.endDate}`);
  if (ctx.tripDurationDays != null) known.push(`duration=${ctx.tripDurationDays} days`);
  if (ctx.budgetInr != null) known.push(`budget INR=${ctx.budgetInr}`);
  if (ctx.travelers != null) known.push(`travelers=${ctx.travelers}`);

  const lines = ['[GATHERED TRIP DETAILS]'];
  lines.push(
    known.length
      ? `Known from this conversation (do NOT ask again): ${known.join('; ')}.`
      : 'Known from this conversation: none yet.',
  );
  lines.push(
    status.complete
      ? 'Still needed: none — all required trip fields are present.'
      : `Still needed (ask at most ONE of these): ${status.missing.join(', ')}.`,
  );
  if (ctx.origin?.trim()) {
    lines.push(
      'Origin is already set (from device location or the user). Do NOT ask for origin city unless they want to change it.',
    );
  }
  if (status.complete) {
    lines.push(
      'All required fields are present. The server auto-saves the trip when needed — do NOT ask the user to confirm creation. If [AUTO ACTION] ran, confirm it is saved and viewable in the Trips tab. Otherwise use update_trip/delete_trip for changes; never re-ask known fields.',
    );
  } else {
    const missingForUser = status.missing.filter((field) => field !== 'origin city' || !ctx.origin?.trim());
    lines.push(
      missingForUser.length
        ? `Do not call create_trip until these are known. Ask for at most ONE: ${missingForUser.join(', ')}.`
        : 'Do not call create_trip until required fields are known.',
    );
  }
  return lines.join('\n');
}

export function messageProvidesTripDetail(message: string): boolean {
  const ctx = parseTripContextFromText(message);
  return Boolean(
    ctx.destination ||
      ctx.origin ||
      ctx.startDate ||
      ctx.endDate ||
      ctx.tripDurationDays != null ||
      ctx.budgetInr != null ||
      ctx.travelers != null,
  );
}

export function messageIsTripPlanningFlow(message: string): boolean {
  const m = message.toLowerCase();
  return (
    /\b(plan|trip|travel|visit|holiday|vacation|getaway|itinerary|weekend)\b/.test(m) ||
    /\b(create|make|book|organize|organise)\s+(?:a\s+)?(?:new\s+)?trip\b/.test(m) ||
    messageProvidesTripDetail(message)
  );
}

/** User wants to view or save an existing trip in the Trips tab (no new trip fields). */
export function messageIsTripsTabNavigationIntent(message: string): boolean {
  if (messageProvidesTripDetail(message)) return false;
  const m = message.toLowerCase().trim();
  return (
    /\b(show|open|view|see|go to)\b.*\b(trips?\s*tab|my trips?)\b/.test(m) ||
    /\b(create|save|add)\b.*\b(in|to|on)\b.*\b(trips?\s*tab|my trips?)\b/.test(m)
  );
}

/** User wants to delete/remove a trip (not providing new trip fields). */
export function messageIsTripDeleteRequest(message: string): boolean {
  if (messageProvidesTripDetail(message)) return false;
  const m = message.toLowerCase().trim();
  return (
    /\b(delete|remove|cancel)\b/.test(m) &&
    /\b(trip|itinerary|plan|this)\b/.test(m)
  );
}

function extractTripDeleteQuery(
  message: string,
  gathered?: GatheredTripContext,
): string | undefined {
  if (gathered?.destination?.trim()) return gathered.destination.trim();
  const labeled = message.match(/\bdelete\s+(?:this|the|my)\s+(.+?)\s+trip\b/i);
  if (labeled?.[1]) return labeled[1].trim();
  const q = messageTripQuery(message);
  return q.trim() || undefined;
}

export function messageIsTripManagementOnly(message: string): boolean {
  if (messageProvidesTripDetail(message)) return false;
  if (messageIsTripsTabNavigationIntent(message)) return true;
  const m = message.toLowerCase().trim();
  return (
    (/\b(delete|remove|cancel)\b/.test(m) && /\b(trip|itinerary|plan)\b/.test(m)) ||
    (/\b(list|show|how many)\b/.test(m) && /\b(trips?|itinerar(?:y|ies))\b/.test(m)) ||
    /\b(update|change|edit|regenerate|refresh)\b/.test(m)
  );
}

function gatheredDiffersFromActiveTrip(
  gathered: GatheredTripContext,
  trip: TripSummary,
): boolean {
  const dates = resolveGatheredTripDates(gathered);
  if (dates.startDate && trip.start_date && dates.startDate !== trip.start_date.trim()) {
    return true;
  }
  if (dates.endDate && trip.end_date && dates.endDate !== trip.end_date.trim()) {
    return true;
  }
  if (
    gathered.budgetInr != null &&
    trip.budget_usd != null &&
    Math.round(gathered.budgetInr) !== Math.round(Number(trip.budget_usd))
  ) {
    return true;
  }
  if (
    gathered.travelers != null &&
    Math.round(gathered.travelers) !== Math.round(trip.travelers)
  ) {
    return true;
  }
  const origin = gathered.origin?.trim();
  if (origin && trip.origin_city && normalize(origin) !== normalize(trip.origin_city)) {
    return true;
  }
  return false;
}

export function resolveTripPersistAction(
  gathered: GatheredTripContext,
  activeTrip?: TripSummary,
  opts?: { conversationTripId?: string },
): 'create' | 'update' | 'none' {
  if (!assessTripRequirements(gathered).complete) return 'none';
  const destination = gathered.destination?.trim();
  if (!destination) return 'none';
  if (!activeTrip) return 'create';

  const sameTrip = scoreTrip(activeTrip, destination) >= 8;
  if (!sameTrip) return 'create';

  if (gatheredDiffersFromActiveTrip(gathered, activeTrip)) {
    if (opts?.conversationTripId === activeTrip.id) return 'update';
    return 'create';
  }

  const incomplete =
    !activeTrip.start_date ||
    !activeTrip.end_date ||
    !activeTrip.budget_usd ||
    activeTrip.travelers < 1;
  if (incomplete || activeTrip.status === 'draft') return 'update';
  return 'none';
}

export function tripSummaryToGatheredContext(trip: TripSummary): GatheredTripContext {
  return {
    destination: trip.destination,
    origin: trip.origin_city ?? undefined,
    startDate: trip.start_date ?? undefined,
    endDate: trip.end_date ?? undefined,
    budgetInr: trip.budget_usd != null ? Number(trip.budget_usd) : undefined,
    travelers: trip.travelers,
  };
}

export function isTripConfirmationMessage(
  message: string,
  opts?: { summaryPresentedInHistory?: boolean },
): boolean {
  const m = message.toLowerCase().trim();
  if (!m || m.length > 120) return false;

  const explicitConfirm =
    /\b(save|saved|confirm|confirmed|approve|approved|mark\b.*\bsaved)\b/.test(m) ||
    /\b(that'?s fine|all good|looks good|all things are correct|everything is correct|everything looks good|sounds good|go ahead and (?:save|create|book))\b/.test(m) ||
    (/\b(correct|yes|okay|ok|fine|proceed|go ahead)\b/.test(m) &&
      /\b(trip|itinerary|plan|draft|budget|summary|details)\b/.test(m));

  if (explicitConfirm) return true;

  if (opts?.summaryPresentedInHistory) {
    return /^(yes|yeah|yep|sure|ok|okay|please|do it|go ahead|confirm|confirmed|save|saved|sounds good|looks good)\b/i.test(
      m,
    );
  }

  return false;
}

/** True when create_trip / update_trip tools may persist a saved trip for this turn. */
export function allowSavedTripCreateFromChat(
  message: string,
  gathered: GatheredTripContext,
): boolean {
  if (messageIsTripManagementOnly(message)) return false;
  return assessTripRequirements(gathered).complete;
}

/** True when gathered requirements are complete and a create/update should run (not user confirm). */
export function canPersistTripFromChat(
  message: string,
  gathered: GatheredTripContext,
  _history: ChatHistoryMessage[] = [],
  activeTrip?: TripSummary,
  conversationTripId?: string,
): boolean {
  if (!allowSavedTripCreateFromChat(message, gathered)) return false;
  return resolveTripPersistAction(gathered, activeTrip, { conversationTripId }) !== 'none';
}

export async function maybeAutoPersistTrip(input: {
  supabase: SupabaseClient;
  userId: string;
  authHeader: string;
  message: string;
  gathered: GatheredTripContext;
  history?: ChatHistoryMessage[];
  activeTrip?: TripSummary;
  activeTripId?: string;
  conversationId?: string;
  conversationTripId?: string;
  sessionCreatedTripId?: string;
}): Promise<{
  effects: ChatToolEffect[];
  contextSection: string;
  disableTools: boolean;
  connectedTripId?: string;
  openTripId?: string;
}> {
  const assessment = assessTripRequirements(input.gathered);
  const contextSection = formatGatheredTripDetailsSection(input.gathered, assessment);

  const persistAction = resolveTripPersistAction(input.gathered, input.activeTrip, {
    conversationTripId: input.conversationTripId,
  });

  if (
    !canPersistTripFromChat(
      input.message,
      input.gathered,
      input.history ?? [],
      input.activeTrip,
      input.conversationTripId,
    )
  ) {
    console.warn('[chat-persist] auto-persist skipped: canPersistTripFromChat=false', {
      complete: assessment.complete,
      missing: assessment.missing,
      action: persistAction,
      gathered: input.gathered,
      hasClientOrigin: Boolean(input.gathered.origin?.trim()),
    });
    return { effects: [], contextSection, disableTools: false };
  }

  const action = persistAction;
  if (action === 'none') {
    console.warn('[chat-persist] auto-persist skipped: resolveTripPersistAction=none', {
      complete: assessment.complete,
      gathered: input.gathered,
      activeTripId: input.activeTrip?.id,
    });
    return { effects: [], contextSection, disableTools: false };
  }

  const sharedDates = resolveGatheredTripDates(input.gathered);
  const sharedArgs: Record<string, unknown> = {
    destination: input.gathered.destination,
    originCity: input.gathered.origin,
    startDate: sharedDates.startDate,
    endDate: sharedDates.endDate,
    budgetInr: input.gathered.budgetInr,
    travelers: input.gathered.travelers,
    status: 'saved',
    generatePlan: true,
    refreshTravelOptions: Boolean(input.gathered.origin && sharedDates.startDate),
  };
  if (
    input.gathered.tripDurationDays != null &&
    Number.isFinite(input.gathered.tripDurationDays) &&
    !input.gathered.endDate?.trim()
  ) {
    sharedArgs.tripDurationDays = input.gathered.tripDurationDays;
  }

  console.warn('[chat-persist] create_trip payload', {
    startDate: sharedArgs.startDate,
    endDate: sharedArgs.endDate,
    tripDurationDays: sharedArgs.tripDurationDays,
    destination: sharedArgs.destination,
    originCity: sharedArgs.originCity,
  });

  const createValidation = validateTripCreateArgs(sharedArgs, {
    allowSavedTripCreate: true,
    gathered: input.gathered,
  });
  if (!createValidation.valid) {
    console.warn('[chat-persist] auto-persist skipped: validateTripCreateArgs failed', {
      error: createValidation.error,
      missing: createValidation.missing,
    });
    return { effects: [], contextSection, disableTools: false };
  }

  if (action === 'create') {
    const result = await executeChatTool({
      name: 'create_trip',
      args: sharedArgs,
      supabase: input.supabase,
      userId: input.userId,
      authHeader: input.authHeader,
      activeTripId: input.activeTripId,
      conversationId: input.conversationId,
      conversationTripId: input.conversationTripId ?? input.activeTripId,
      sessionCreatedTripId: input.sessionCreatedTripId,
      allowSavedTripCreate: true,
      gatheredTripContext: input.gathered,
    });
    if (!result.toolResult.success) {
      console.warn('[chat-persist] executeChatTool create_trip failed', {
        error: result.toolResult.error,
      });
      return { effects: [], contextSection, disableTools: false };
    }
    const effects = result.effect ? [result.effect] : [];
    console.warn('[chat-persist] create_trip succeeded', {
      tripId: result.toolResult.tripId ?? result.effect?.tripId,
    });
    return {
      effects,
      contextSection: [
        contextSection,
        '[AUTO ACTION]',
        'create_trip succeeded. Tell the user the trip is saved and opening in Trips. Do not ask to create the trip or re-ask details listed under Known.',
      ].join('\n'),
      disableTools: true,
      connectedTripId: result.effect?.tripId,
      openTripId: result.effect?.openTripId,
    };
  }

  const result = await executeChatTool({
    name: 'update_trip',
    args: {
      tripId: input.activeTrip!.id,
      ...sharedArgs,
      rebalanceBudget: true,
    },
    supabase: input.supabase,
    userId: input.userId,
    authHeader: input.authHeader,
    activeTripId: input.activeTripId,
    allowSavedTripCreate: true,
  });
  if (!result.toolResult.success) {
    return { effects: [], contextSection, disableTools: false };
  }

  const effects = result.effect ? [result.effect] : [];
  let connectedTripId = result.effect?.tripId;
  let openTripId: string | undefined;

  const shouldRegenerate =
    input.activeTrip!.status === 'draft' ||
    !input.activeTrip!.start_date ||
    !input.activeTrip!.end_date;
  if (shouldRegenerate) {
    const regen = await executeChatTool({
      name: 'regenerate_trip_plan',
      args: { tripId: input.activeTrip!.id },
      supabase: input.supabase,
      userId: input.userId,
      authHeader: input.authHeader,
      activeTripId: input.activeTripId,
    });
    if (regen.effect) effects.push(regen.effect);
    connectedTripId = regen.effect?.tripId ?? connectedTripId;
  }

  return {
    effects,
    contextSection: [
      contextSection,
      '[AUTO ACTION]',
      'update_trip (and plan regeneration when needed) succeeded. Tell the user the trip is saved and opening in Trips. Do not ask to create the trip or re-ask known fields.',
    ].join('\n'),
    disableTools: true,
    connectedTripId,
    openTripId: connectedTripId,
  };
}

export async function maybeAutoDeleteTrip(input: {
  supabase: SupabaseClient;
  userId: string;
  authHeader: string;
  message: string;
  gathered?: GatheredTripContext;
  activeTripId?: string;
  conversationTripId?: string;
}): Promise<{
  effects: ChatToolEffect[];
  contextSection: string;
  disableTools: boolean;
}> {
  if (!messageIsTripDeleteRequest(input.message)) {
    return { effects: [], contextSection: '', disableTools: false };
  }

  const tripId = input.conversationTripId ?? input.activeTripId;
  const query = extractTripDeleteQuery(input.message, input.gathered);
  const args: Record<string, unknown> = tripId ? { tripId } : { query: query ?? input.message };

  const result = await executeChatTool({
    name: 'delete_trip',
    args,
    supabase: input.supabase,
    userId: input.userId,
    authHeader: input.authHeader,
    activeTripId: input.activeTripId,
    conversationTripId: input.conversationTripId,
  });

  if (!result.toolResult.success) {
    console.warn('[chat-persist] auto-delete failed', {
      error: result.toolResult.error,
      tripId,
      query,
    });
    return {
      effects: [],
      contextSection: `[AUTO DELETE FAILED] ${result.toolResult.error ?? 'Could not delete trip.'}`,
      disableTools: false,
    };
  }

  const effect = result.effect;
  const deletedTripId = result.toolResult.tripId ?? effect?.tripId;
  console.warn('[chat-persist] delete_trip succeeded', { tripId: deletedTripId });

  return {
    effects: effect ? [effect] : [],
    contextSection: [
      '[AUTO ACTION]',
      'delete_trip succeeded. Confirm the trip was removed only because this action succeeded.',
    ].join('\n'),
    disableTools: true,
  };
}

export function messageNeedsChatTools(
  message: string,
  opts?: {
    activeTripId?: string;
    activeTripStatus?: string;
    gatheredTrip?: GatheredTripContext;
    tripPlanningComplete?: boolean;
  },
): boolean {
  const m = message.toLowerCase().trim();
  if (opts?.tripPlanningComplete && !messageIsTripManagementOnly(message)) return true;
  if (messageProvidesTripDetail(message)) return true;
  if (opts?.gatheredTrip && assessTripRequirements(opts.gatheredTrip).missing.length <= 2) {
    return true;
  }
  if (messageIsTripPlanningFlow(message)) return true;
  if (m.length < 28 && /^(hi|hello|hey|thanks|thank you|ok|okay|sure|great|cool|good morning|good evening)\b/.test(m)) {
    if (!opts?.activeTripId || !isTripConfirmationMessage(message)) return false;
  }
  if (opts?.activeTripId && isTripConfirmationMessage(message)) return true;
  if (opts?.activeTripId && opts.activeTripStatus === 'draft' && /\b(fine|ok|okay|correct|good|yes|save)\b/.test(m)) {
    return true;
  }
  return (
    /\b(create|update|change|edit|regenerate|refresh|save|saved|list|show|open|delete|remove|cancel)\b/.test(m) ||
    /\b(my trips?|trip count|how many trips)\b/.test(m) ||
    /\b(plan my trip|create a trip|new trip|add trip|generate plan|make a trip)\b/.test(m) ||
    (/\b(delete|remove|cancel)\b/.test(m) && /\b(trip|itinerary|this)\b/.test(m)) ||
    (/\b(budget|itinerary|packing|hotel|flight|train)\b/.test(m) && /\b(trip|for this|my)\b/.test(m))
  );
}

const TRIP_SAVED_CLAIM_RE =
  /\b(successfully created|has been created|trip (?:is |was |has been )?saved|saved in your (system|account)|created and saved|your trip has been saved|you can (?:now )?view.*(?:trips tab|your account)|trip to .+ has been successfully|will (?:now )?create|i(?:'|’)?ll create|i will create|creating your trip|create your trip(?:\s+now)?|create your trip automatically|automatically create(?:d)?(?:\s+your)?\s+trip|have all the required information|trip is now saved|updated the trip details)\b/i;

const TRIP_DELETED_CLAIM_RE =
  /\b(?:i(?:'|’)?ve\s+)?(?:deleted|removed|cancelled)\s+(?:the\s+)?trip\b/i;

export const TRIP_SAVE_FAILURE_REPLY =
  'I could not save your trip to your account. Please try confirming again in a moment.';

export const TRIP_DELETE_FAILURE_REPLY =
  'I could not delete that trip from your account. Please try again from the Trips tab.';

const TRIP_LIST_VISIBLE_STATUSES = new Set(['saved', 'upcoming']);

/** True when chat tool effects include a trip row persisted via create or update. */
export function tripWasPersistedFromEffects(effects: ChatToolEffect[]): {
  persisted: boolean;
  tripId?: string;
} {
  for (const effect of effects) {
    if (
      (effect.type === 'create_trip' || effect.type === 'update_trip') &&
      effect.tripId
    ) {
      return { persisted: true, tripId: effect.tripId };
    }
  }
  return { persisted: false };
}

/** Remove raw tool/function markup the model sometimes prints as plain text. */
export function stripRawToolMarkupFromReply(reply: string): string {
  let text = reply.trim();
  text = text.replace(/<function[^>]*>[\s\S]*?<\/function>/gi, '').trim();
  text = text.replace(/<function[^>]*>\s*\{[\s\S]*?\}\s*/gi, '').trim();
  text = text.replace(/<function[^>]*>[\s\S]*/gi, '').trim();
  text = text.replace(
    /this function call failed\.?\s*(?:i need|i still need|please provide)[\s\S]*$/i,
    '',
  ).trim();
  return text;
}

const BROKEN_PERSISTED_REPLY_RE =
  /function call failed|still need|missing:|cannot create|tool call validation/i;

/** Normalize assistant text after a verified trip persist. */
export function tripWasDeletedFromEffects(effects: ChatToolEffect[]): {
  deleted: boolean;
  tripId?: string;
} {
  for (const effect of effects) {
    if (effect.type === 'delete_trip' && effect.tripId) {
      return { deleted: true, tripId: effect.tripId };
    }
  }
  return { deleted: false };
}

export function polishAssistantTripReply(
  reply: string,
  effects: ChatToolEffect[],
  destination?: string,
): string {
  let text = stripRawToolMarkupFromReply(reply);
  const { deleted, tripId: deletedTripId } = tripWasDeletedFromEffects(effects);
  if (deleted) {
    return 'Your trip has been deleted. The Trips tab has been updated.';
  }
  const { persisted } = tripWasPersistedFromEffects(effects);
  if (!persisted) return text;
  if (!text || BROKEN_PERSISTED_REPLY_RE.test(text) || text.length < 24) {
    const dest = destination?.trim() || 'your destination';
    return `Your trip to ${dest} is saved. Open the Trips tab below to view it.`;
  }
  return text;
}

/** Strip false "trip saved" claims when no successful persist effect ran. */
export function reconcileTripPersistReply(
  reply: string,
  effects: ChatToolEffect[],
  gathered?: GatheredTripContext,
): string {
  const { deleted } = tripWasDeletedFromEffects(effects);
  const cleaned = stripRawToolMarkupFromReply(reply);
  if (deleted) return polishAssistantTripReply(cleaned, effects);
  if (TRIP_DELETED_CLAIM_RE.test(cleaned)) return TRIP_DELETE_FAILURE_REPLY;

  const { persisted } = tripWasPersistedFromEffects(effects);
  if (persisted) return polishAssistantTripReply(cleaned, effects, gathered?.destination);
  if (!TRIP_SAVED_CLAIM_RE.test(cleaned)) return cleaned;
  const assessment = gathered ? assessTripRequirements(gathered) : null;
  if (assessment?.complete) {
    return TRIP_SAVE_FAILURE_REPLY;
  }
  const missing = assessment?.missing?.length
    ? assessment.missing.join(', ')
    : 'destination, origin, dates, travelers, budget';
  return `I have not saved a trip to your account yet. Still needed: ${missing}. I will save automatically once these are set.`;
}

export async function verifyTripOwnedByUser(
  supabase: SupabaseClient,
  userId: string,
  tripId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('trips')
    .select('id')
    .eq('id', tripId)
    .eq('user_id', userId)
    .maybeSingle();
  return !error && Boolean(data?.id);
}

/** Trip exists for this user with a status shown in the Trips tab. */
export async function verifyTripSavedForUser(
  supabase: SupabaseClient,
  userId: string,
  tripId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('trips')
    .select('id, status')
    .eq('id', tripId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data?.id) return false;
  return TRIP_LIST_VISIBLE_STATUSES.has(String((data as { status?: string }).status ?? ''));
}

/** Drop persist effects and reconcile reply when the trip row is missing from DB. */
export async function finalizeTripPersistResult(input: {
  supabase: SupabaseClient;
  userId: string;
  reply: string;
  effects: ChatToolEffect[];
  gathered?: GatheredTripContext;
  openTripId?: string;
  connectedTripId?: string;
}): Promise<{
  reply: string;
  effects: ChatToolEffect[];
  openTripId?: string;
  connectedTripId?: string;
}> {
  const { deleted, tripId: deletedTripId } = tripWasDeletedFromEffects(input.effects);
  if (deleted && deletedTripId) {
    const stillOwned = await verifyTripOwnedByUser(
      input.supabase,
      input.userId,
      deletedTripId,
    );
    if (stillOwned) {
      const effects = input.effects.filter((effect) => effect.type !== 'delete_trip');
      return {
        reply: TRIP_DELETE_FAILURE_REPLY,
        effects,
        openTripId: undefined,
        connectedTripId: input.connectedTripId === deletedTripId
          ? undefined
          : input.connectedTripId,
      };
    }
  }

  const { persisted, tripId } = tripWasPersistedFromEffects(input.effects);
  if (persisted && tripId) {
    const exists = await verifyTripSavedForUser(input.supabase, input.userId, tripId);
    if (!exists) {
      const effects = input.effects.filter(
        (effect) => effect.type !== 'create_trip' && effect.type !== 'update_trip',
      );
      return {
        reply: TRIP_SAVE_FAILURE_REPLY,
        effects,
        openTripId: undefined,
        connectedTripId: input.connectedTripId === tripId ? undefined : input.connectedTripId,
      };
    }
  }

  return {
    reply: reconcileTripPersistReply(input.reply, input.effects, input.gathered),
    effects: input.effects,
    openTripId: input.openTripId,
    connectedTripId: input.connectedTripId,
  };
}

/** When the user confirms a draft trip without tool use, persist status saved + notify. */
export async function finalizeTripOnUserConfirmation(input: {
  supabase: SupabaseClient;
  userId: string;
  message: string;
  history?: ChatHistoryMessage[];
  gathered?: GatheredTripContext;
  activeTrip?: TripSummary;
  effects: ChatToolEffect[];
}): Promise<ChatToolEffect | null> {
  const trip = input.activeTrip;
  if (!trip) return null;
  const gathered = input.gathered ?? tripSummaryToGatheredContext(trip);
  if (!canPersistTripFromChat(input.message, gathered, input.history ?? [], trip)) return null;
  if (!assessTripRequirements(gathered).complete) return null;
  if (trip.status === 'saved' || trip.status === 'completed') return null;
  const alreadyUpdated = input.effects.some(
    (effect) => effect.type === 'update_trip' && effect.tripId === trip.id,
  );
  if (alreadyUpdated) return null;

  const { error } = await input.supabase
    .from('trips')
    .update({ status: 'saved', updated_at: new Date().toISOString() })
    .eq('id', trip.id)
    .eq('user_id', input.userId);
  if (error) throw error;

  const persisted = await verifyTripSavedForUser(input.supabase, input.userId, trip.id);
  if (!persisted) return null;

  await insertTripActivityNotifications(input.supabase, {
    userId: input.userId,
    tripId: trip.id,
    destination: trip.destination,
    startDate: trip.start_date,
    kinds: ['trip_saved'],
  });

  return {
    type: 'update_trip',
    tripId: trip.id,
    summary: `Saved ${trip.destination} after user confirmation.`,
  };
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

const TRIP_CREATE_IDEMPOTENCY_WINDOW_MS = 15 * 60 * 1000;
const CHAT_REQUEST_REPLAY_WINDOW_MS = 30 * 60 * 1000;

async function linkConversationToTrip(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string | undefined,
  tripId: string,
): Promise<void> {
  if (!conversationId) return;
  await supabase
    .from('chat_conversations')
    .update({ trip_id: tripId, updated_at: new Date().toISOString() })
    .eq('id', conversationId)
    .eq('user_id', userId);
}

/** Replay a prior assistant response for the same clientRequestId (retries / duplicate HTTP). */
export async function findChatRequestReplay(input: {
  supabase: SupabaseClient;
  conversationId: string;
  clientRequestId: string;
}): Promise<{
  reply: string;
  effects: ChatToolEffect[];
  connectedTripId?: string;
  openTripId?: string;
} | null> {
  const { data: userRows, error: userError } = await input.supabase
    .from('chat_messages')
    .select('id, created_at, metadata')
    .eq('conversation_id', input.conversationId)
    .eq('role', 'user')
    .contains('metadata', { clientRequestId: input.clientRequestId })
    .order('created_at', { ascending: true })
    .limit(1);
  if (userError) throw userError;
  const userMsg = userRows?.[0] as { id: string; created_at: string } | undefined;
  if (!userMsg) return null;

  const { data: assistantRows, error: assistantError } = await input.supabase
    .from('chat_messages')
    .select('content, metadata, created_at')
    .eq('conversation_id', input.conversationId)
    .eq('role', 'assistant')
    .gte('created_at', userMsg.created_at)
    .order('created_at', { ascending: true })
    .limit(1);
  if (assistantError) throw assistantError;
  const assistant = assistantRows?.[0] as {
    content: string;
    metadata?: { toolEffects?: ChatToolEffect[]; tripId?: string; openTripId?: string };
  } | undefined;
  if (!assistant?.content?.trim()) return null;

  const createdAt = new Date(assistant.created_at).getTime();
  if (Number.isNaN(createdAt) || Date.now() - createdAt > CHAT_REQUEST_REPLAY_WINDOW_MS) {
    return null;
  }

  const effects = Array.isArray(assistant.metadata?.toolEffects)
    ? assistant.metadata!.toolEffects!
    : [];
  const { tripId } = tripWasPersistedFromEffects(effects);
  return {
    reply: assistant.content.trim(),
    effects,
    connectedTripId: assistant.metadata?.tripId ?? tripId,
    openTripId: assistant.metadata?.openTripId ?? tripId,
  };
}

/** True when this clientRequestId is already being processed (user msg saved, assistant not yet). */
export async function isChatRequestInFlight(input: {
  supabase: SupabaseClient;
  conversationId: string;
  clientRequestId: string;
}): Promise<boolean> {
  const replay = await findChatRequestReplay(input);
  if (replay) return false;
  const { data: userRows, error } = await input.supabase
    .from('chat_messages')
    .select('created_at')
    .eq('conversation_id', input.conversationId)
    .eq('role', 'user')
    .contains('metadata', { clientRequestId: input.clientRequestId })
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  const userMsg = userRows?.[0] as { created_at: string } | undefined;
  if (!userMsg) return false;
  const createdAt = new Date(userMsg.created_at).getTime();
  return !Number.isNaN(createdAt) && Date.now() - createdAt < 120_000;
}

async function findIdempotentTripForCreate(
  supabase: SupabaseClient,
  userId: string,
  input: {
    destination: string;
    startDate: string | null;
    endDate: string | null;
    conversationId?: string;
    conversationTripId?: string;
    sessionCreatedTripId?: string;
  },
): Promise<TripSummary | null> {
  const trips = await fetchTripSummaries(supabase, userId);
  const cutoff = Date.now() - TRIP_CREATE_IDEMPOTENCY_WINDOW_MS;

  if (input.sessionCreatedTripId) {
    const sessionTrip = trips.find((trip) => trip.id === input.sessionCreatedTripId);
    if (sessionTrip) return sessionTrip;
  }

  if (input.conversationId) {
    const conversation = await fetchConversation(supabase, userId, input.conversationId);
    if (conversation?.trip_id) {
      const linkedTrip = trips.find((trip) => trip.id === conversation.trip_id);
      if (linkedTrip) return linkedTrip;
    }
  }

  if (input.conversationTripId) {
    const linkedTrip = trips.find((trip) => trip.id === input.conversationTripId);
    if (linkedTrip && scoreTrip(linkedTrip, input.destination) >= 8) return linkedTrip;
  }

  const destinationNorm = normalize(input.destination);
  for (const trip of trips) {
    const updatedAt = new Date(trip.updated_at).getTime();
    if (Number.isNaN(updatedAt) || updatedAt < cutoff) continue;
    const sameDestination =
      normalize(trip.destination) === destinationNorm || scoreTrip(trip, input.destination) >= 12;
    if (!sameDestination) continue;
    if (input.startDate && trip.start_date && trip.start_date !== input.startDate) continue;
    if (input.endDate && trip.end_date && trip.end_date !== input.endDate) continue;
    return trip;
  }

  return null;
}

async function resolveTrip(
  supabase: SupabaseClient,
  userId: string,
  args: { tripId?: string; query?: string; activeTripId?: string },
): Promise<{ trip?: TripSummary; error?: string; candidates?: TripSummary[] }> {
  const trips = await fetchTripSummaries(supabase, userId);
  if (args.tripId) {
    const exact = trips.find((trip) => trip.id === args.tripId);
    if (exact) return { trip: exact };
    return { error: 'Trip not found or not owned by this user.' };
  }

  const q = (args.query ?? '').trim();
  if (!q) {
    if (args.activeTripId) {
      const active = trips.find((trip) => trip.id === args.activeTripId);
      if (active) return { trip: active };
    }
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
  /** True when starting a brand-new conversation (no cross-chat trip planning bleed). */
  isNewConversation?: boolean;
}): Promise<ChatMemoryContext> {
  const { supabase, userId } = input;
  const isNewConversation = input.isNewConversation ?? !input.conversationId;
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
  const activeTripId = input.requestedTripId ?? conversation?.trip_id ?? undefined;

  const includeTripDetails = shouldIncludeTripDetails(input.userMessage);

  const [history, snippets, details] = await Promise.all([
    input.conversationId
      ? safeDb('fetch persisted chat history', () =>
        fetchConversationMessages(supabase, input.conversationId!, 8)
      )
      : Promise.resolve(null),
    isNewConversation
      ? Promise.resolve(null)
      : safeDb('fetch cross conversation memory', () =>
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
    isNewConversation
      ? 'This is a new conversation — do not reuse destination, dates, budget, or travelers from other chats; collect fresh details in this thread only.'
      : snippets?.length
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
    'Use tools for saved-trip facts, counts, create/update/regenerate/refresh/delete. Never claim a DB change without tool success.',
  ];

  return {
    contextText: sections.join('\n'),
    authoritativeHistory,
    activeTripId,
    activeTrip,
    conversationTripId: conversation?.trip_id ?? undefined,
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
  activeTripId?: string;
  conversationId?: string;
  conversationTripId?: string;
  sessionCreatedTripId?: string;
  /** When false, create_trip cannot set status saved/upcoming (planning must finish + user confirm first). */
  allowSavedTripCreate?: boolean;
  /** Conversation-gathered fields used to block invented dates, duration, budget, or travelers. */
  gatheredTripContext?: GatheredTripContext;
}): Promise<ChatToolExecutionResult> {
  const { name, args, supabase, userId, authHeader, activeTripId } = input;
  const allowSavedTripCreate = input.allowSavedTripCreate === true;
  const tripLookup = {
    tripId: typeof args.tripId === 'string' ? args.tripId : undefined,
    query: typeof args.query === 'string' ? args.query : undefined,
    activeTripId,
  };

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
    const resolved = await resolveTrip(supabase, userId, tripLookup);
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
    const resolved = await resolveTrip(supabase, userId, { ...tripLookup, query });
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
      const nextStatus = args.status;
      if (
        (nextStatus === 'saved' || nextStatus === 'upcoming') &&
        !allowSavedTripCreate
      ) {
        // Defer marking saved until the user confirms the planning summary.
      } else {
        patch.status = nextStatus;
      }
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

    const tripRow = resolved.trip;
    const isNoOpUpdate =
      (patch.title === undefined || patch.title === tripRow.title) &&
      (patch.destination === undefined || patch.destination === tripRow.destination) &&
      (patch.origin_city === undefined || patch.origin_city === tripRow.origin_city) &&
      (patch.start_date === undefined || patch.start_date === tripRow.start_date) &&
      (patch.end_date === undefined || patch.end_date === tripRow.end_date) &&
      (patch.travelers === undefined || patch.travelers === tripRow.travelers) &&
      (patch.budget_usd === undefined || patch.budget_usd === tripRow.budget_usd) &&
      (patch.status === undefined || patch.status === tripRow.status);
    if (isNoOpUpdate) {
      const details = await fetchTripDetails(supabase, userId, tripRow.id);
      return {
        toolResult: {
          success: true,
          alreadyApplied: true,
          tripId: tripRow.id,
          changedFields: [],
          details,
          message: 'Trip already has these values — no update needed.',
        },
        effect: {
          type: 'update_trip',
          tripId: tripRow.id,
          summary: `No changes needed for ${tripRow.destination}.`,
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

    const notificationKinds: Array<
      'trip_updated' | 'trip_saved' | 'budget_generated'
    > = ['trip_updated'];
    if (patch.status === 'saved') notificationKinds.push('trip_saved');
    if (budgetInr != null) notificationKinds.push('budget_generated');
    const savedVisible =
      patch.status === 'saved'
        ? await verifyTripSavedForUser(supabase, userId, resolved.trip.id)
        : await verifyTripOwnedByUser(supabase, userId, resolved.trip.id);
    if (!savedVisible) {
      return {
        toolResult: {
          success: false,
          error: 'Trip update did not persist — please try again.',
        },
      };
    }

    await insertTripActivityNotifications(supabase, {
      userId,
      tripId: resolved.trip.id,
      destination: resolved.trip.destination,
      startDate: resolved.trip.start_date,
      kinds: notificationKinds,
    });

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
    if (!allowSavedTripCreate) {
      return {
        toolResult: {
          success: false,
          error:
            'Cannot create a trip until destination, origin, dates or duration, travelers, and INR budget are collected in this conversation.',
          missing: ['required trip fields'],
        },
      };
    }

    const validation = validateTripCreateArgs(args, {
      allowSavedTripCreate,
      gathered: input.gatheredTripContext,
    });
    if (!validation.valid) {
      return {
        toolResult: {
          success: false,
          error: validation.error,
          missing: validation.missing,
        },
      };
    }

    const resolvedDates = resolveCreateTripDatesFromArgs(args);
    const destination = String(args.destination ?? '').trim();
    const title = String(args.title ?? '').trim() || destination;
    const budgetInr = asNumber(args.budgetInr)!;
    const travelers = Math.max(1, Math.round(asNumber(args.travelers)!));
    const startDate = resolvedDates.startDate!;
    const endDate = resolvedDates.endDate!;
    const status = 'saved';

    const existingTrip = await findIdempotentTripForCreate(supabase, userId, {
      destination,
      startDate,
      endDate,
      conversationId: input.conversationId,
      conversationTripId: input.conversationTripId ?? activeTripId,
      sessionCreatedTripId: input.sessionCreatedTripId,
    });
    if (existingTrip) {
      if (!TRIP_LIST_VISIBLE_STATUSES.has(existingTrip.status)) {
        const { error: promoteError } = await supabase
          .from('trips')
          .update({
            status,
            title,
            destination,
            origin_city: typeof args.originCity === 'string' && args.originCity.trim()
              ? args.originCity.trim()
              : existingTrip.origin_city,
            start_date: startDate,
            end_date: endDate,
            travelers,
            budget_usd: budgetInr,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingTrip.id)
          .eq('user_id', userId);
        if (promoteError) {
          return {
            toolResult: {
              success: false,
              error: promoteError.message ?? 'Could not save the existing trip.',
            },
          };
        }
      }

      await linkConversationToTrip(
        supabase,
        userId,
        input.conversationId,
        existingTrip.id,
      );

      const existingPersisted = await verifyTripSavedForUser(
        supabase,
        userId,
        existingTrip.id,
      );
      if (!existingPersisted) {
        return {
          toolResult: {
            success: false,
            error: 'Trip could not be verified in your account after save.',
          },
        };
      }

      await insertTripActivityNotifications(supabase, {
        userId,
        tripId: existingTrip.id,
        destination: existingTrip.destination,
        startDate,
        kinds: ['trip_created', 'trip_saved'],
      });

      const details = await fetchTripDetails(supabase, userId, existingTrip.id);
      return {
        toolResult: {
          success: true,
          alreadyExists: true,
          trip: existingTrip,
          tripId: existingTrip.id,
          openTripId: existingTrip.id,
          details,
          message:
            'Trip already exists for this request — returning the existing trip instead of creating a duplicate.',
        },
        effect: {
          type: 'create_trip',
          tripId: existingTrip.id,
          openTripId: existingTrip.id,
          summary: `Trip "${existingTrip.title}" for ${existingTrip.destination} already exists — skipped duplicate create.`,
        },
      };
    }

    const { data: trip, error } = await supabase
      .from('trips')
      .insert({
        user_id: userId,
        title,
        destination,
        origin_city: typeof args.originCity === 'string' && args.originCity.trim()
          ? args.originCity.trim()
          : null,
        start_date: startDate,
        end_date: endDate,
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
    if (!tripId) {
      return {
        toolResult: {
          success: false,
          error: 'Trip insert did not return an id — please try again.',
        },
      };
    }

    await linkConversationToTrip(supabase, userId, input.conversationId, tripId);

    const persistedBeforePlan = await verifyTripSavedForUser(supabase, userId, tripId);
    if (!persistedBeforePlan) {
      return {
        toolResult: {
          success: false,
          error: 'Trip insert did not persist — please try again.',
        },
      };
    }

    await insertTripActivityNotifications(supabase, {
      userId,
      tripId,
      destination,
      startDate,
      kinds: ['trip_created', 'trip_saved'],
    });

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
        tripId,
        trip,
        generation: generation?.data ?? null,
        refresh,
        details,
        openTripId: tripId,
        planGenerated: generation?.ok === true,
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
    const resolved = await resolveTrip(supabase, userId, tripLookup);
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
    const resolved = await resolveTrip(supabase, userId, tripLookup);
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

  if (name === 'delete_trip') {
    const resolved = await resolveTrip(supabase, userId, tripLookup);
    if (!resolved.trip) {
      if (tripLookup.tripId) {
        const owned = await verifyTripOwnedByUser(supabase, userId, tripLookup.tripId);
        if (!owned) {
          return {
            toolResult: {
              success: true,
              alreadyDeleted: true,
              tripId: tripLookup.tripId,
              message: 'Trip was already removed.',
            },
            effect: {
              type: 'delete_trip',
              tripId: tripLookup.tripId,
              summary: 'Trip was already deleted.',
            },
          };
        }
      }
      return {
        toolResult: {
          success: false,
          error: resolved.error,
          candidates: resolved.candidates,
        },
      };
    }

    const trip = resolved.trip;
    const destination = trip.destination.trim() || trip.title.trim() || 'your trip';

    const { error } = await supabase
      .from('trips')
      .delete()
      .eq('id', trip.id)
      .eq('user_id', userId);
    if (error) {
      return {
        toolResult: {
          success: false,
          error: error.message ?? 'Could not delete trip.',
        },
      };
    }

    await insertTripDeletedNotification(supabase, {
      userId,
      destination,
    });
    await updateProfileTripStats(supabase, userId);

    return {
      toolResult: {
        success: true,
        tripId: trip.id,
        destination,
        message: 'Trip deleted successfully.',
      },
      effect: {
        type: 'delete_trip',
        tripId: trip.id,
        summary: `Deleted trip for ${destination}.`,
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
