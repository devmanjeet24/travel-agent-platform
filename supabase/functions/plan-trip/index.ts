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
  shouldIncludeFlights,
  tripDaysFromDates,
} from '../_shared/transport-guidance.ts';
import {
  buildTravelContext,
  fetchWeather,
  geocodeDestination,
  geocodeNearDestination,
  searchFlightsEstimate,
  searchHotelsOsm,
} from '../_shared/travel-apis.ts';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

type PlanBody = { tripId?: string };

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const { user, supabase } = auth;

  const groqKey = Deno.env.get('GROQ_API_KEY');
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

    const travelContext = await buildTravelContext({
      destination: trip.destination,
      origin: trip.origin_city ?? undefined,
      startDate: trip.start_date ?? undefined,
      endDate: trip.end_date ?? undefined,
      budgetInr,
      travelers: trip.travelers,
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
- Packing list should reflect weather in live data.
${PLAN_TRANSPORT_RULES}
Destination: ${trip.destination}
Origin: ${trip.origin_city ?? 'not specified'}
Travelers: ${trip.travelers}
Budget (INR): ${budgetInr != null ? `₹${budgetInr.toLocaleString('en-IN')}` : 'flexible'}
Dates: ${trip.start_date ?? 'flexible'} to ${trip.end_date ?? 'flexible'}

[LIVE TRAVEL DATA]
${travelContext}`;

    const groqRes = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: PLAN_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        temperature: 0.4,
        max_tokens: 4096,
        response_format: { type: 'json_object' },
      }),
    });

    const groqData = await groqRes.json();
    if (!groqRes.ok) {
      return jsonResponse(
        { error: groqData?.error?.message ?? 'Groq request failed' },
        groqRes.status,
      );
    }

    const raw = groqData?.choices?.[0]?.message?.content?.trim() ?? '{}';
    const plan = JSON.parse(raw) as {
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

    const geo = await geocodeDestination(trip.destination);

    let routeAnalysis = null;
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

    await supabase.from('itinerary_days').delete().eq('trip_id', trip.id);
    await supabase.from('budget_categories').delete().eq('trip_id', trip.id);
    await supabase.from('packing_items').delete().eq('trip_id', trip.id);

    for (const day of plan.itinerary ?? []) {
      const { data: dayRow } = await supabase
        .from('itinerary_days')
        .insert({
          trip_id: trip.id,
          day_number: day.day,
          title: day.title,
        })
        .select('id')
        .single();

      if (dayRow?.id) {
        const activities = [];
        for (let i = 0; i < (day.activities ?? []).length; i++) {
          const a = day.activities[i];
          let lat = a.lat ?? null;
          let lon = a.lon ?? null;
          if ((lat == null || lon == null) && geo && a.name) {
            const coords = await geocodeNearDestination(a.name, geo);
            if (coords) {
              lat = coords.lat;
              lon = coords.lon;
            }
            await new Promise((r) => setTimeout(r, 250));
          }
          activities.push({
            day_id: dayRow.id,
            activity_time: a.time,
            name: a.name,
            cost_usd: resolveActivityCostInr({
              cost: a.cost_usd,
              name: a.name,
              transport: a.transport,
              distanceKm: routeAnalysis?.distanceKm,
              travelers: trip.travelers,
            }),
            transport: normalizeActivityTransport(a.transport, routeAnalysis),
            notes: a.notes,
            latitude: lat,
            longitude: lon,
            sort_order: i,
          });
        }
        if (activities.length) {
          await supabase.from('itinerary_activities').insert(activities);
        }
      }
    }

    if (plan.budget?.length) {
      await supabase.from('budget_categories').insert(
        plan.budget.map((b, i) => ({
          trip_id: trip.id,
          label: b.label,
          amount_usd: b.amount_usd,
          color: b.color,
          sort_order: i,
        })),
      );
    }

    if (plan.packing?.length) {
      await supabase.from('packing_items').insert(
        plan.packing.map((label, i) => ({
          trip_id: trip.id,
          label,
          sort_order: i,
        })),
      );
    }

    let weatherSummary: Record<string, unknown> | null = null;
    if (geo) {
      const weather = await fetchWeather(geo.lat, geo.lon);
      if (weather) {
        weatherSummary = {
          summary: weather.summary,
          daily: weather.daily.slice(0, 7),
          timezone: weather.timezone,
        };
      }
      await supabase
        .from('trips')
        .update({
          destination_lat: geo.lat,
          destination_lon: geo.lon,
          country: geo.country,
          weather_summary: weatherSummary,
          status: 'saved',
          updated_at: new Date().toISOString(),
        })
        .eq('id', trip.id);

      const hotelResult = await searchHotelsOsm(geo, budgetInr);
      if (hotelResult.offers.length) {
        await supabase.from('trip_hotels').delete().eq('trip_id', trip.id);
        await supabase.from('trip_hotels').insert(
          hotelResult.offers.map((h) => ({
            trip_id: trip.id,
            external_id: h.id,
            name: h.name,
            rating: h.rating,
            price_per_night_usd: h.pricePerNightUsd,
            image_url: h.imageUrl,
            raw: { ...h.raw, source: h.source },
          })),
        );
      }

      if (trip.origin_city && trip.start_date && routeAnalysis && shouldIncludeFlights(routeAnalysis)) {
        const originGeo = await geocodeDestination(trip.origin_city);
        if (originGeo) {
          const flightResult = await searchFlightsEstimate({
            originGeo,
            destGeo: geo,
            departDate: trip.start_date,
            budgetInr,
          });
          if (flightResult.offers.length) {
            await supabase.from('trip_flights').delete().eq('trip_id', trip.id);
            await supabase.from('trip_flights').insert(
              flightResult.offers.map((f) => ({
                trip_id: trip.id,
                airline: f.airline,
                route: f.route,
                depart_time: f.departTime,
                arrive_time: f.arriveTime,
                price_usd: f.priceUsd,
                stops: f.stops,
                raw: { ...f.raw, source: f.source },
              })),
            );
          }
        }
      } else if (trip.origin_city) {
        await supabase.from('trip_flights').delete().eq('trip_id', trip.id);
      }
    }

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

    return jsonResponse({ success: true, plan, weather: weatherSummary });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return jsonResponse({ error: msg }, 500);
  }
});
