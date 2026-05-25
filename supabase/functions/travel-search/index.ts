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
      const incomingCoordinatesValid = isValidLatLon(body.lat, body.lon);
      const incomingDistanceFromGeocode =
        incomingCoordinatesValid && destinationGeo
          ? haversineKm(body.lat!, body.lon!, destinationGeo.lat, destinationGeo.lon)
          : null;
      const useIncomingCoordinates =
        incomingCoordinatesValid &&
        (!destinationGeo || incomingDistanceFromGeocode == null || incomingDistanceFromGeocode < 250);
      console.debug('[travel-search] hotel coordinates', {
        destination: dest,
        incomingLat: body.lat,
        incomingLon: body.lon,
        incomingCoordinatesValid,
        geocodedLat: destinationGeo?.lat ?? null,
        geocodedLon: destinationGeo?.lon ?? null,
        incomingDistanceFromGeocode,
        useIncomingCoordinates,
      });
      let geo = useIncomingCoordinates
        ? geoFromCoordinates(
          body.lat!,
          body.lon!,
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
      console.debug('[travel-search] hotel API response', {
        destination: dest,
        searchedFrom: geo.displayName,
        lat: geo.lat,
        lon: geo.lon,
        hotelCount: result.offers.length,
        error: result.error ?? null,
      });
      const tripImageUrl =
        geo.imageUrl ?? result.offers.find((h) => h.imageUrl)?.imageUrl ?? null;

      if (body.tripId) {
        const tripPatch: Record<string, unknown> = {
          destination_lat: geo.lat,
          destination_lon: geo.lon,
          country: geo.country || destinationGeo?.country || null,
          updated_at: new Date().toISOString(),
        };
        if (tripImageUrl) tripPatch.image_url = tripImageUrl;
        const { error: tripImageError } = await supabase
          .from('trips')
          .update(tripPatch)
          .eq('id', body.tripId);
        if (tripImageError) {
          console.error('Could not update trip destination geo/image:', tripImageError.message);
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
