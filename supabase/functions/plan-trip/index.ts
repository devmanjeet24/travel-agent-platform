import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { requireUser } from '../_shared/auth.ts';
import {
  buildTravelContext,
  fetchWeather,
  geocodeDestination,
  geocodeNearDestination,
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

    const travelContext = await buildTravelContext({
      destination: trip.destination,
      origin: trip.origin_city ?? undefined,
      startDate: trip.start_date ?? undefined,
      endDate: trip.end_date ?? undefined,
      budgetUsd: trip.budget_usd ? Number(trip.budget_usd) : undefined,
      travelers: trip.travelers,
    });

    const prompt = `Create a structured travel plan as JSON only (no markdown fences).
Schema:
{
  "itinerary": [{"day":1,"title":"...","activities":[{"time":"09:00","name":"...","cost_usd":0,"transport":"...","notes":"...","lat":null,"lon":null}]}],
  "budget": [{"label":"Flights","amount_usd":0,"color":"#EAB308"},{"label":"Hotels","amount_usd":0,"color":"#000000"},{"label":"Food","amount_usd":0,"color":"#16A34A"},{"label":"Activities","amount_usd":0,"color":"#FACC15"},{"label":"Transport","amount_usd":0,"color":"#CA8A04"},{"label":"Misc","amount_usd":0,"color":"#737373"}],
  "packing": ["item1","item2"]
}
Rules:
- Use costs from [LIVE TRAVEL DATA] when present; otherwise realistic estimates within budget.
- Include lat/lon for major activities when you know approximate coordinates.
- Packing list should reflect weather in live data.
Destination: ${trip.destination}
Travelers: ${trip.travelers}
Budget USD: ${trip.budget_usd ?? 'flexible'}

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
          {
            role: 'system',
            content:
              'You are a travel planner. Output valid JSON only. Never invent specific booking IDs.',
          },
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
            cost_usd: a.cost_usd ?? 0,
            transport: a.transport,
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
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('ai_plans_generated')
      .eq('id', user.id)
      .single();
    await supabase
      .from('profiles')
      .update({
        ai_plans_generated: (profile?.ai_plans_generated ?? 0) + 1,
      })
      .eq('id', user.id);

    return jsonResponse({ success: true, plan, weather: weatherSummary });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return jsonResponse({ error: msg }, 500);
  }
});
