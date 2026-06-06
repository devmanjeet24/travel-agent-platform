import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { requireUser } from '../_shared/auth.ts';
import {
  PLAN_SYSTEM_PROMPT,
  PLAN_TRANSPORT_RULES,
} from '../_shared/plan-prompt.ts';
import {
  analyzeRoute,
  normalizeActivityTransport,
  resolveActivityCostInr,
  tripDaysFromDates,
} from '../_shared/transport-guidance.ts';
import {
  buildTravelContext,
  fetchWeather,
  geocodeDestination,
  geocodeNearDestination,
  isPlaceholderTripImageUrl,
  searchPlaces,
  type PlaceOffer,
} from '../_shared/travel-apis.ts';
import { fetchGroqWith429Retry } from '../_shared/groq-fetch.ts';
import { logGroqUsage } from '../_shared/groq-usage.ts';
import { createServiceSupabase, sendExpoPushToUser } from '../_shared/expo-push.ts';
import { insertTripActivityNotifications } from '../_shared/trip-notifications.ts';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL_70B = 'llama-3.3-70b-versatile';
const MODEL_8B = 'llama-3.1-8b-instant';
const GROQ_TIMEOUT_MS = 45_000;
const BASE_ACTIVITY_GEOCODE_LIMIT = 8;
const LONG_TRIP_ACTIVITY_GEOCODE_LIMIT = 3;
const deno = globalThis as typeof globalThis & {
  Deno: {
    env: { get(name: string): string | undefined };
    serve(handler: (req: Request) => Response | Promise<Response>): void;
  };
};

type PlanBody = { tripId?: string };
type RouteAnalysisResult = ReturnType<typeof analyzeRoute>;
type ActivityInsert = {
  day_id: string;
  activity_time: string;
  name: string;
  cost_usd: number;
  transport: string | null;
  notes?: string;
  latitude: number | null;
  longitude: number | null;
  sort_order: number;
};

function isValidLatLon(lat: number | null | undefined, lon: number | null | undefined): boolean {
  if (lat == null || lon == null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return false;
  if (Math.abs(lat) < 0.0001 && Math.abs(lon) < 0.0001) return false;
  return true;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function maxActivityDistanceKm(placeType?: string): number {
  const type = (placeType ?? '').toLowerCase();
  if (['administrative', 'country', 'boundary'].includes(type)) return 800;
  return 120;
}

function activityGeocodeLimit(tripDays: number): number {
  return tripDays > 10 ? LONG_TRIP_ACTIVITY_GEOCODE_LIMIT : BASE_ACTIVITY_GEOCODE_LIMIT;
}

function isDiningActivity(name: string, notes?: string): boolean {
  return /\b(breakfast|brunch|lunch|dinner|meal|restaurant|cafe|coffee|food|dining)\b/i.test(
    `${name} ${notes ?? ''}`,
  );
}

function isGenericPlaceActivity(name: string, notes?: string): boolean {
  return /\b(local attraction|nearby attraction|sightseeing|explore|visit|museum|market|park)\b/i.test(
    `${name} ${notes ?? ''}`,
  );
}

function placeNote(place: PlaceOffer): string {
  const details = [
    place.address,
    place.cuisine ? `Cuisine: ${place.cuisine}` : null,
    `Source: ${place.source}`,
  ].filter(Boolean);
  return details.join(' · ');
}

function realDiningActivityName(originalName: string, placeName: string): string {
  const prefix = originalName.replace(/\bat\s+.+$/i, '').trim();
  return `${prefix || 'Meal'} at ${placeName}`;
}

function consumeRealPlace(
  places: PlaceOffer[],
  usedPlaceIds: Set<string>,
  category: PlaceOffer['category'],
): PlaceOffer | null {
  const match = places.find((place) => place.category === category && !usedPlaceIds.has(place.id));
  if (!match) return null;
  usedPlaceIds.add(match.id);
  return match;
}

function assertNoDbError(
  result: { error?: { message?: string } | null },
  action: string,
) {
  if (result.error) {
    throw new Error(`${action}: ${result.error.message ?? 'Database request failed'}`);
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function plannerErrorMessage(e: unknown): string {
  if (e instanceof DOMException && e.name === 'AbortError') {
    return 'Trip planning timed out while waiting for an external AI or travel API. Please try again.';
  }
  return e instanceof Error ? e.message : 'Unknown error';
}

deno.Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const { user, supabase } = auth;

  const groqKey = deno.Deno.env.get('GROQ_API_KEY');
  if (!groqKey) {
    return jsonResponse({ error: 'GROQ_API_KEY is not set' }, 500);
  }

  try {
    const body = (await req.json()) as PlanBody;
    if (!body.tripId) return jsonResponse({ error: 'tripId is required' }, 400);

    const { data: trip, error: tripErr } = await supabase
      .from('trips')
      .select('*')
      .eq('id', body.tripId)
      .eq('user_id', user.id)
      .single();

    if (tripErr || !trip) {
      return jsonResponse({ error: 'Trip not found' }, 404);
    }

    const budgetInr = trip.budget_usd ? Number(trip.budget_usd) : undefined;
    const tripDays = tripDaysFromDates(trip.start_date ?? undefined, trip.end_date ?? undefined);

    const travelContext = await buildTravelContext({
      destination: trip.destination,
      origin: trip.origin_city ?? undefined,
      startDate: trip.start_date ?? undefined,
      endDate: trip.end_date ?? undefined,
      budgetInr,
      travelers: trip.travelers,
      includeHotels: false,
      includeFlightOffers: false,
    });

    const prompt = `Create a structured travel plan as JSON only (no markdown fences).
All monetary values are in Indian Rupees (INR). JSON field names use amount_usd/cost_usd but store INR amounts.
Schema:
{
  "itinerary": [{"day":1,"title":"...","activities":[{"time":"09:00","name":"...","cost_usd":0,"transport":"...","notes":"...","lat":null,"lon":null}]}],
  "budget": [{"label":"Flights","amount_usd":0,"color":"#EAB308"},{"label":"Hotels","amount_usd":0,"color":"#000000"},{"label":"Food","amount_usd":0,"color":"#16A34A"},{"label":"Activities","amount_usd":0,"color":"#FACC15"},{"label":"Transport","amount_usd":0,"color":"#CA8A04"},{"label":"Misc","amount_usd":0,"color":"#737373"}],
  "packing": ["item1","item2"]
}
Rules:
- Use INR costs from [LIVE TRAVEL DATA] when present; otherwise realistic India-first estimates within budget.
- India pricing guide: Train ₹500–₹2500; Bus ₹300–₹1500; Food ₹200–₹800/meal; Budget hotel ₹1000–₹4000/night; Activities ₹200–₹2000.
- Include lat/lon for major activities when you know approximate coordinates.
- For restaurants, cafes, and named attractions, prefer entries from [REAL RESTAURANT/PLACE DATA] and copy their lat/lon exactly.
- Packing list should reflect weather in live data.
- Create exactly ${tripDays} itinerary day${tripDays === 1 ? '' : 's'} when dates are provided.
- Keep JSON compact: ${tripDays > 10 ? 'for this longer trip use 1–2 concise activities per day.' : 'use 2–3 concise activities per day.'}
${PLAN_TRANSPORT_RULES}
Destination: ${trip.destination}
Origin: ${trip.origin_city ?? 'not specified'}
Travelers: ${trip.travelers}
Budget (INR): ${budgetInr != null ? `₹${budgetInr.toLocaleString('en-IN')}` : 'flexible'}
Dates: ${trip.start_date ?? 'flexible'} to ${trip.end_date ?? 'flexible'}

[LIVE TRAVEL DATA]
${travelContext}`;

    const plannerModel = tripDays > 10 ? MODEL_70B : MODEL_8B;
    const plannerMaxTokens = Math.min(
      tripDays > 10 ? 6144 : 4096,
      1_200 + tripDays * 200,
    );

    const groqRes = await fetchGroqWith429Retry(
      GROQ_URL,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: plannerModel,
          messages: [
            { role: 'system', content: PLAN_SYSTEM_PROMPT },
            { role: 'user', content: prompt },
          ],
          temperature: 0.4,
          max_tokens: plannerMaxTokens,
          response_format: { type: 'json_object' },
        }),
      },
      (url, init) => fetchWithTimeout(url, init, GROQ_TIMEOUT_MS),
    );

    const groqData = await groqRes.json().catch(() => null);
    logGroqUsage('plan_trip', (groqData ?? {}) as Record<string, unknown>, plannerModel, {
      user_id: user.id,
    });
    if (!groqRes.ok) {
      return jsonResponse(
        { error: groqData?.error?.message ?? 'Groq request failed' },
        groqRes.status,
      );
    }

    const choice = groqData?.choices?.[0];
    if (choice?.finish_reason === 'length') {
      throw new Error('Planner response was too large and was truncated. Please shorten the trip dates and try again.');
    }

    const raw = choice?.message?.content?.trim() ?? '{}';
    let plan: {
      itinerary?: Array<{
        day: number;
        title: string;
        activities: Array<{
          time: string;
          name: string;
          cost_usd?: number;
          transport?: string;
          notes?: string;
          lat?: number | null;
          lon?: number | null;
        }>;
      }>;
      budget?: Array<{ label: string; amount_usd: number; color?: string }>;
      packing?: string[];
    };
    try {
      plan = JSON.parse(raw);
    } catch {
      throw new Error('Planner returned invalid JSON. Please try again.');
    }
    if (!Array.isArray(plan.itinerary) || plan.itinerary.length === 0) {
      throw new Error('Planner returned an empty itinerary. Please try again.');
    }

    const geo = await geocodeDestination(trip.destination);
    console.debug('[plan-trip] destination geocode', {
      destination: trip.destination,
      lat: geo?.lat ?? null,
      lon: geo?.lon ?? null,
      displayName: geo?.displayName ?? null,
      placeType: geo?.placeType ?? null,
    });

    let routeAnalysis: RouteAnalysisResult | null = null;
    if (geo && trip.origin_city) {
      const originGeo = await geocodeDestination(trip.origin_city);
      if (originGeo) {
        routeAnalysis = analyzeRoute({
          originGeo,
          destGeo: geo,
          budgetInr,
          travelers: trip.travelers,
          tripDays: tripDaysFromDates(trip.start_date ?? undefined, trip.end_date ?? undefined),
        });
      }
    }
    const realPlaces = geo ? (await searchPlaces(geo, { maxItems: 14 })).places : [];
    const usedPlaceIds = new Set<string>();

    assertNoDbError(
      await supabase.from('itinerary_days').delete().eq('trip_id', trip.id),
      'Clear existing itinerary',
    );
    assertNoDbError(
      await supabase.from('budget_categories').delete().eq('trip_id', trip.id),
      'Clear existing budget',
    );
    assertNoDbError(
      await supabase.from('packing_items').delete().eq('trip_id', trip.id),
      'Clear existing packing list',
    );

    const maxActivityGeocodes = activityGeocodeLimit(tripDays);
    let activityGeocodeAttempts = 0;
    for (const day of plan.itinerary ?? []) {
      const { data: dayRow, error: dayInsertError } = await supabase
        .from('itinerary_days')
        .insert({
          trip_id: trip.id,
          day_number: day.day,
          title: day.title,
        })
        .select('id')
        .single();
      assertNoDbError({ error: dayInsertError }, `Insert itinerary day ${day.day}`);

      if (dayRow?.id) {
        const activities: ActivityInsert[] = [];
        for (let i = 0; i < (day.activities ?? []).length; i++) {
          const a = day.activities[i];
          const realPlace = isDiningActivity(a.name, a.notes)
            ? consumeRealPlace(realPlaces, usedPlaceIds, 'restaurant')
            : isGenericPlaceActivity(a.name, a.notes)
              ? consumeRealPlace(realPlaces, usedPlaceIds, 'place')
              : null;
          const activityName = realPlace
            ? isDiningActivity(a.name, a.notes)
              ? realDiningActivityName(a.name, realPlace.name)
              : realPlace.name
            : a.name;
          let lat = typeof a.lat === 'number' ? a.lat : null;
          let lon = typeof a.lon === 'number' ? a.lon : null;
          let coordinateSource = lat != null && lon != null ? 'ai' : 'missing';
          if (realPlace) {
            lat = realPlace.latitude;
            lon = realPlace.longitude;
            coordinateSource = realPlace.source;
          }
          if (lat != null && lon != null && !isValidLatLon(lat, lon)) {
            coordinateSource = 'ai-invalid';
            lat = null;
            lon = null;
          }
          if (lat != null && lon != null && geo) {
            const distanceKm = haversineKm(geo.lat, geo.lon, lat, lon);
            if (distanceKm > maxActivityDistanceKm(geo.placeType)) {
              console.warn('[plan-trip] rejected distant activity coordinates', {
                activity: activityName,
                lat,
                lon,
                destination: geo.displayName,
                distanceKm,
              });
              coordinateSource = 'ai-too-far';
              lat = null;
              lon = null;
            }
          }
          if (
            (lat == null || lon == null) &&
            geo &&
            activityName &&
            activityGeocodeAttempts < maxActivityGeocodes
          ) {
            activityGeocodeAttempts += 1;
            const coords = await geocodeNearDestination(activityName, geo);
            if (coords) {
              lat = coords.lat;
              lon = coords.lon;
              coordinateSource = 'nominatim';
            }
            await new Promise((r) => setTimeout(r, 250));
          } else if ((lat == null || lon == null) && geo && activityName) {
            coordinateSource = 'skipped-limit';
          }
          console.debug('[plan-trip] activity coordinates', {
            activity: activityName,
            coordinateSource,
            lat,
            lon,
          });
          activities.push({
            day_id: dayRow.id,
            activity_time: a.time,
            name: activityName,
            cost_usd: resolveActivityCostInr({
              cost: a.cost_usd,
              name: activityName,
              transport: a.transport,
              distanceKm: routeAnalysis?.distanceKm,
              travelers: trip.travelers,
            }),
            transport: normalizeActivityTransport(a.transport, routeAnalysis),
            notes: realPlace ? placeNote(realPlace) || a.notes : a.notes,
            latitude: lat,
            longitude: lon,
            sort_order: i,
          });
        }
        if (activities.length) {
          assertNoDbError(
            await supabase.from('itinerary_activities').insert(activities),
            `Insert activities for day ${day.day}`,
          );
        }
      }
    }

    if (plan.budget?.length) {
      assertNoDbError(
        await supabase.from('budget_categories').insert(
          plan.budget.map((b, i) => ({
            trip_id: trip.id,
            label: b.label,
            amount_usd: b.amount_usd,
            color: b.color,
            sort_order: i,
          })),
        ),
        'Insert budget categories',
      );
    }

    if (plan.packing?.length) {
      assertNoDbError(
        await supabase.from('packing_items').insert(
          plan.packing.map((label, i) => ({
            trip_id: trip.id,
            label,
            sort_order: i,
          })),
        ),
        'Insert packing items',
      );
    }

    let weatherSummary: Record<string, unknown> | null = null;
    const tripPatch: Record<string, unknown> = {
      status: 'saved',
      updated_at: new Date().toISOString(),
    };
    if (geo) {
      const weather = await fetchWeather(geo.lat, geo.lon);
      if (weather) {
        weatherSummary = {
          summary: weather.summary,
          daily: weather.daily.slice(0, 7),
          timezone: weather.timezone,
        };
      }
      const existingTripImageUrl = isPlaceholderTripImageUrl(trip.image_url)
        ? null
        : trip.image_url;
      const tripImageUrl = geo.imageUrl ?? existingTripImageUrl ?? null;
      tripPatch.destination_lat = geo.lat;
      tripPatch.destination_lon = geo.lon;
      tripPatch.country = geo.country;
      tripPatch.image_url = tripImageUrl;
      tripPatch.weather_summary = weatherSummary;
    }
    assertNoDbError(
      await supabase.from('trips').update(tripPatch).eq('id', trip.id),
      'Update planned trip',
    );

    const { data: userTrips } = await supabase
      .from('trips')
      .select('id, country')
      .eq('user_id', user.id);

    const tripIds = (userTrips ?? []).map((t) => t.id as string);
    let aiPlansCount = 0;
    if (tripIds.length) {
      const { data: itineraryRows } = await supabase
        .from('itinerary_days')
        .select('trip_id')
        .in('trip_id', tripIds);
      aiPlansCount = new Set(
        (itineraryRows ?? []).map((r) => r.trip_id as string),
      ).size;
    }

    const countries = new Set(
      (userTrips ?? [])
        .map((t) => t.country as string | null)
        .filter((c): c is string => Boolean(c)),
    );
    if (geo?.country) countries.add(geo.country);

    await supabase
      .from('profiles')
      .update({
        trips_count: userTrips?.length ?? 0,
        countries_visited: countries.size,
        ai_plans_generated: aiPlansCount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    await insertTripActivityNotifications(supabase, {
      userId: user.id,
      tripId: trip.id,
      destination: trip.destination,
      startDate: trip.start_date,
      kinds: ['trip_saved', 'itinerary_generated', 'budget_generated', 'packing_generated'],
    });

    const pushAdmin = createServiceSupabase();
    if (pushAdmin) {
      void sendExpoPushToUser(pushAdmin, user.id, {
        title: 'Itinerary ready',
        body: `Your ${trip.destination} plan is ready to view.`,
        data: { tripId: trip.id, type: 'trip_update' },
      }).catch((e) => {
        console.warn('[plan-trip] push failed:', e);
      });
    }

    return jsonResponse({ success: true, plan, weather: weatherSummary });
  } catch (e) {
    return jsonResponse({ error: plannerErrorMessage(e) }, 500);
  }
});
