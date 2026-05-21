import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { requireUser } from '../_shared/auth.ts';
import {
  buildTravelContext,
  fetchWeather,
  geocodeDestination,
  searchFlightsEstimate,
  searchHotelsOsm,
} from '../_shared/travel-apis.ts';

type SearchBody = {
  action?: 'geocode' | 'weather' | 'hotels' | 'flights' | 'context';
  destination?: string;
  origin?: string;
  lat?: number;
  lon?: number;
  startDate?: string;
  endDate?: string;
  departDate?: string;
  tripId?: string;
  budgetUsd?: number;
};

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const { supabase } = auth;

  try {
    const body = (await req.json()) as SearchBody;
    const action = body.action ?? 'context';

    if (action === 'geocode') {
      const geo = await geocodeDestination(body.destination ?? '');
      if (!geo) return jsonResponse({ error: 'Destination not found' }, 404);
      return jsonResponse({ geo });
    }

    if (action === 'weather') {
      let lat = body.lat;
      let lon = body.lon;
      if ((lat == null || lon == null) && body.destination) {
        const geo = await geocodeDestination(body.destination);
        if (!geo) return jsonResponse({ error: 'Destination not found' }, 404);
        lat = geo.lat;
        lon = geo.lon;
      }
      if (lat == null || lon == null) {
        return jsonResponse({ error: 'lat/lon or destination required' }, 400);
      }
      const weather = await fetchWeather(lat, lon);
      if (!weather) return jsonResponse({ error: 'Weather unavailable' }, 502);
      return jsonResponse({ weather });
    }

    if (action === 'hotels') {
      const dest = body.destination ?? '';
      const geo = await geocodeDestination(dest);
      if (!geo) {
        return jsonResponse({ error: 'Destination not found' }, 404);
      }
      const result = await searchHotelsOsm(geo, body.budgetUsd);

      if (body.tripId && result.offers.length) {
        await supabase.from('trip_hotels').delete().eq('trip_id', body.tripId);
        await supabase.from('trip_hotels').insert(
          result.offers.map((h) => ({
            trip_id: body.tripId,
            external_id: h.id,
            name: h.name,
            rating: h.rating,
            price_per_night_usd: h.pricePerNightUsd,
            image_url: h.imageUrl,
            raw: { ...h.raw, source: h.source },
          })),
        );
      }

      return jsonResponse({
        hotels: result.offers,
        error: result.error ?? null,
        source: 'openstreetmap',
      });
    }

    if (action === 'flights') {
      if (!body.origin || !body.destination || !body.departDate) {
        return jsonResponse({
          error: 'origin, destination, and departDate required',
        }, 400);
      }
      const originGeo = await geocodeDestination(body.origin);
      const destGeo = await geocodeDestination(body.destination);
      if (!originGeo || !destGeo) {
        return jsonResponse({ error: 'Could not geocode origin or destination' }, 404);
      }
      const result = await searchFlightsEstimate({
        originGeo,
        destGeo,
        departDate: body.departDate,
        budgetUsd: body.budgetUsd,
      });

      if (body.tripId && result.offers.length) {
        await supabase.from('trip_flights').delete().eq('trip_id', body.tripId);
        await supabase.from('trip_flights').insert(
          result.offers.map((f) => ({
            trip_id: body.tripId,
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

      return jsonResponse({
        flights: result.offers,
        error: result.error ?? null,
        source: 'estimate',
      });
    }

    const context = await buildTravelContext({
      destination: body.destination,
      origin: body.origin,
      startDate: body.startDate,
      endDate: body.endDate,
      budgetUsd: body.budgetUsd,
    });
    return jsonResponse({ context });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return jsonResponse({ error: msg }, 500);
  }
});
