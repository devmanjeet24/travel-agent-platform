import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { requireUser } from '../_shared/auth.ts';
import {
  buildTravelContext,
  fetchWeather,
  geoFromCoordinates,
  geocodeDestination,
  searchCitySuggestions,
  searchFlightsEstimate,
  searchHotelsOsm,
} from '../_shared/travel-apis.ts';
import {
  analyzeRoute,
  shouldIncludeFlights,
  tripDaysFromDates,
} from '../_shared/transport-guidance.ts';

type SearchBody = {
  action?: 'geocode' | 'weather' | 'hotels' | 'flights' | 'context' | 'cities' | 'route';
  query?: string;
  destination?: string;
  origin?: string;
  lat?: number;
  lon?: number;
  startDate?: string;
  endDate?: string;
  departDate?: string;
  tripId?: string;
  /** Trip budget in INR (legacy field name budgetUsd also accepted). */
  budgetInr?: number;
  budgetUsd?: number;
  travelers?: number;
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
    const budgetInr = body.budgetInr ?? body.budgetUsd;
    const action = body.action ?? 'context';

    if (action === 'cities') {
      const suggestions = await searchCitySuggestions(body.query ?? '');
      return jsonResponse({ suggestions });
    }

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
      const destinationGeo = dest ? await geocodeDestination(dest) : null;
      let geo =
        body.lat != null && body.lon != null
          ? geoFromCoordinates(
            body.lat,
            body.lon,
            dest,
            destinationGeo?.country ?? '',
            destinationGeo?.countryCode,
            destinationGeo?.placeType,
            destinationGeo?.imageUrl ?? null,
          )
          : null;
      if (!geo) {
        geo = destinationGeo;
      }
      if (!geo) {
        return jsonResponse({ error: 'Destination not found' }, 404);
      }
      const result = await searchHotelsOsm(geo, budgetInr);
      const tripImageUrl =
        geo.imageUrl ?? result.offers.find((h) => h.imageUrl)?.imageUrl ?? null;

      if (body.tripId && tripImageUrl) {
        const { error: tripImageError } = await supabase
          .from('trips')
          .update({ image_url: tripImageUrl, updated_at: new Date().toISOString() })
          .eq('id', body.tripId);
        if (tripImageError) {
          console.error('Could not update trip destination image:', tripImageError.message);
        }
      }

      if (body.tripId && result.offers.length) {
        const { error: deleteError } = await supabase
          .from('trip_hotels')
          .delete()
          .eq('trip_id', body.tripId);
        if (deleteError) {
          return jsonResponse({ error: deleteError.message }, 500);
        }
        const { error: insertError } = await supabase.from('trip_hotels').insert(
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
        if (insertError) {
          return jsonResponse({ error: insertError.message }, 500);
        }
      }

      return jsonResponse({
        hotels: result.offers,
        error: result.error ?? null,
        source: 'openstreetmap',
        geocodedAs: geo.displayName,
      });
    }

    if (action === 'route') {
      if (!body.origin || !body.destination) {
        return jsonResponse({ error: 'origin and destination required' }, 400);
      }
      const originGeo = await geocodeDestination(body.origin);
      const destGeo = await geocodeDestination(body.destination);
      if (!originGeo || !destGeo) {
        return jsonResponse({ error: 'Could not geocode origin or destination' }, 404);
      }
      const analysis = analyzeRoute({
        originGeo,
        destGeo,
        budgetInr,
        travelers: body.travelers ?? 1,
        tripDays: tripDaysFromDates(body.startDate, body.endDate),
      });
      return jsonResponse({
        route: {
          includeFlights: shouldIncludeFlights(analysis),
          preferGround: analysis.preferGround,
          flightRecommended: analysis.flightRecommended,
          recommendedModes: analysis.recommendedModes,
          distanceKm: Math.round(analysis.distanceKm),
          budgetTier: analysis.budgetTier,
          sameCountry: analysis.sameCountry,
        },
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

      const route = analyzeRoute({
        originGeo,
        destGeo,
        budgetInr,
        travelers: body.travelers ?? 1,
        tripDays: tripDaysFromDates(body.startDate, body.endDate),
      });

      if (!shouldIncludeFlights(route)) {
        if (body.tripId) {
          await supabase.from('trip_flights').delete().eq('trip_id', body.tripId);
        }
        return jsonResponse({
          flights: [],
          error: 'Flights not recommended for this route/budget — use train, bus, or ferry from your itinerary.',
          source: 'estimate',
          includeFlights: false,
          recommendedModes: route.recommendedModes,
        });
      }

      const result = await searchFlightsEstimate({
        originGeo,
        destGeo,
        departDate: body.departDate,
        budgetInr,
      });

      if (body.tripId) {
        await supabase.from('trip_flights').delete().eq('trip_id', body.tripId);
        if (result.offers.length) {
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
      budgetInr,
    });
    return jsonResponse({ context });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return jsonResponse({ error: msg }, 500);
  }
});
