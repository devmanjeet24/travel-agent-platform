import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { requireUser } from '../_shared/auth.ts';
import {
  buildTravelContext,
  fetchWeather,
  geoFromCoordinates,
  geocodeDestination,
  geocodeNearDestination,
  isPlaceholderTripImageUrl,
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
  action?:
    | 'geocode'
    | 'geocode-itinerary'
    | 'weather'
    | 'hotels'
    | 'flights'
    | 'context'
    | 'cities'
    | 'route';
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

function maxActivityDistanceKm(placeType?: string): number {
  const type = (placeType ?? '').toLowerCase();
  if (['administrative', 'country', 'boundary'].includes(type)) return 800;
  return 120;
}

type CachedHotelRow = {
  id: string;
  external_id: string | null;
  name: string | null;
  raw: Record<string, unknown> | null;
};

function isStaleCachedHotel(row: CachedHotelRow): boolean {
  const name = row.name?.trim() ?? '';
  if (/^hotel\s*\d+$/i.test(name)) return true;
  if (!/^(node|way|relation|nominatim)\//.test(row.external_id ?? '')) return true;
  const source = typeof row.raw?.source === 'string' ? row.raw.source : '';
  return Boolean(source && !['osm', 'openstreetmap', 'nominatim-osm'].includes(source));
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const { user, supabase } = auth;

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
      let updated = false;
      if (body.tripId) {
        const { data: currentTrip, error: currentTripError } = await supabase
          .from('trips')
          .select('image_url')
          .eq('id', body.tripId)
          .eq('user_id', user.id)
          .maybeSingle();
        if (currentTripError) {
          return jsonResponse({ error: currentTripError.message }, 500);
        }
        const tripPatch: Record<string, unknown> = {
          destination_lat: geo.lat,
          destination_lon: geo.lon,
          country: geo.country || null,
          updated_at: new Date().toISOString(),
        };
        if (geo.imageUrl) tripPatch.image_url = geo.imageUrl;
        else if (isPlaceholderTripImageUrl(currentTrip?.image_url)) tripPatch.image_url = null;
        const { error: tripUpdateError } = await supabase
          .from('trips')
          .update(tripPatch)
          .eq('id', body.tripId)
          .eq('user_id', user.id);
        if (tripUpdateError) {
          return jsonResponse({ error: tripUpdateError.message }, 500);
        }
        updated = true;
      }
      return jsonResponse({ geo, updated });
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
      } else if (body.tripId) {
        const { data: cachedHotels, error: cachedHotelsError } = await supabase
          .from('trip_hotels')
          .select('id, external_id, name, raw')
          .eq('trip_id', body.tripId);
        if (cachedHotelsError) {
          return jsonResponse({ error: cachedHotelsError.message }, 500);
        }

        const staleHotelIds = ((cachedHotels ?? []) as CachedHotelRow[])
          .filter(isStaleCachedHotel)
          .map((row) => row.id);
        if (staleHotelIds.length) {
          const { error: deleteStaleError } = await supabase
            .from('trip_hotels')
            .delete()
            .in('id', staleHotelIds);
          if (deleteStaleError) {
            return jsonResponse({ error: deleteStaleError.message }, 500);
          }
        }
      }

      return jsonResponse({
        hotels: result.offers,
        error: result.error ?? null,
        source: 'openstreetmap',
        geocodedAs: geo.displayName,
      });
    }

    if (action === 'geocode-itinerary') {
      if (!body.tripId) {
        return jsonResponse({ error: 'tripId is required' }, 400);
      }

      const { data: trip, error: tripError } = await supabase
        .from('trips')
        .select('id, destination')
        .eq('id', body.tripId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (tripError) return jsonResponse({ error: tripError.message }, 500);
      if (!trip) return jsonResponse({ error: 'Trip not found' }, 404);

      const geo = await geocodeDestination(String(trip.destination ?? ''));
      if (!geo) return jsonResponse({ error: 'Destination not found' }, 404);

      const { data: days, error: daysError } = await supabase
        .from('itinerary_days')
        .select('id')
        .eq('trip_id', body.tripId);
      if (daysError) return jsonResponse({ error: daysError.message }, 500);

      const dayIds = (days ?? []).map((day) => day.id as string);
      if (!dayIds.length) return jsonResponse({ attempted: 0, updated: 0 });

      const { data: activities, error: activitiesError } = await supabase
        .from('itinerary_activities')
        .select('id, name, latitude, longitude')
        .in('day_id', dayIds)
        .order('sort_order');
      if (activitiesError) return jsonResponse({ error: activitiesError.message }, 500);

      let attempted = 0;
      let updated = 0;
      const maxAttempts = 20;
      const maxDistanceKm = maxActivityDistanceKm(geo.placeType);

      for (const activity of activities ?? []) {
        const latitude = activity.latitude == null ? null : Number(activity.latitude);
        const longitude = activity.longitude == null ? null : Number(activity.longitude);
        const hasUsableCoordinate =
          isValidLatLon(latitude, longitude) &&
          haversineKm(geo.lat, geo.lon, latitude!, longitude!) <= maxDistanceKm;

        if (hasUsableCoordinate) continue;
        if (attempted >= maxAttempts) break;

        attempted += 1;
        const coords = await geocodeNearDestination(String(activity.name ?? ''), geo);
        if (coords) {
          const { error: updateActivityError } = await supabase
            .from('itinerary_activities')
            .update({ latitude: coords.lat, longitude: coords.lon })
            .eq('id', activity.id);
          if (updateActivityError) {
            return jsonResponse({ error: updateActivityError.message }, 500);
          }
          updated += 1;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }

      return jsonResponse({ attempted, updated });
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
