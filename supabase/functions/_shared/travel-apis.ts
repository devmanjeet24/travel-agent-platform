/** Geocoding, weather, hotels, and flights using free/public APIs (no API keys). */

export type GeoResult = {
  name: string;
  country: string;
  lat: number;
  lon: number;
  displayName: string;
};

export type WeatherDay = {
  date: string;
  tempMaxC: number;
  tempMinC: number;
  precipitationMm: number;
  weatherCode: number;
};

export type WeatherResult = {
  location: string;
  latitude: number;
  longitude: number;
  timezone: string;
  daily: WeatherDay[];
  summary: string;
};

export type HotelOffer = {
  id: string;
  name: string;
  rating: number | null;
  pricePerNightUsd: number | null;
  imageUrl: string | null;
  source: 'osm' | 'estimate';
  raw: Record<string, unknown>;
};

export type FlightOffer = {
  id: string;
  airline: string;
  route: string;
  departTime: string;
  arriveTime: string;
  priceUsd: number | null;
  stops: string;
  source: 'estimate' | 'osm';
  raw: Record<string, unknown>;
};

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast';
const OVERPASS = 'https://overpass-api.de/api/interpreter';

const NOMINATIM_HEADERS = {
  'User-Agent': 'TravelAgentPlatform/1.0 (supabase-edge; educational)',
};

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
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

function estimateFlightPriceUsd(distanceKm: number): number {
  const base = 120;
  const perKm = 0.11;
  return Math.round(base + distanceKm * perKm);
}

function estimateHotelPriceUsd(stars: number | null, budgetUsd?: number): number {
  if (budgetUsd && budgetUsd > 0) {
    const nightly = Math.round(budgetUsd / 7 / 2);
    return Math.max(45, Math.min(nightly, 450));
  }
  if (stars && stars >= 4) return 180;
  if (stars && stars >= 3) return 120;
  return 85;
}

export async function geocodeDestination(query: string): Promise<GeoResult | null> {
  const q = query.trim();
  if (!q) return null;

  const url = new URL(`${NOMINATIM}/search`);
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('addressdetails', '1');

  const res = await fetch(url.toString(), { headers: NOMINATIM_HEADERS });
  if (!res.ok) return null;

  const data = (await res.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
    address?: { country?: string; city?: string; town?: string };
  }>;

  const hit = data[0];
  if (!hit) return null;

  const name =
    hit.address?.city ?? hit.address?.town ?? q.split(',')[0]?.trim() ?? q;
  return {
    name,
    country: hit.address?.country ?? '',
    lat: Number(hit.lat),
    lon: Number(hit.lon),
    displayName: hit.display_name,
  };
}

/** Geocode a place name near a destination (for itinerary pins). */
export async function geocodeNearDestination(
  placeName: string,
  near: GeoResult,
): Promise<{ lat: number; lon: number } | null> {
  const q = `${placeName}, ${near.name}`;
  const url = new URL(`${NOMINATIM}/search`);
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');

  const res = await fetch(url.toString(), { headers: NOMINATIM_HEADERS });
  if (!res.ok) return null;
  const data = (await res.json()) as Array<{ lat: string; lon: string }>;
  const hit = data[0];
  if (!hit) return null;
  return { lat: Number(hit.lat), lon: Number(hit.lon) };
}

export async function fetchWeather(
  lat: number,
  lon: number,
  days = 7,
): Promise<WeatherResult | null> {
  const url = new URL(OPEN_METEO);
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lon));
  url.searchParams.set(
    'daily',
    'temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode',
  );
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('forecast_days', String(Math.min(days, 16)));

  const res = await fetch(url.toString());
  if (!res.ok) return null;

  const data = await res.json();
  const daily = data.daily;
  if (!daily?.time) return null;

  const weatherDays: WeatherDay[] = daily.time.map((date: string, i: number) => ({
    date,
    tempMaxC: daily.temperature_2m_max[i],
    tempMinC: daily.temperature_2m_min[i],
    precipitationMm: daily.precipitation_sum[i] ?? 0,
    weatherCode: daily.weathercode[i],
  }));

  const avgMax =
    weatherDays.reduce((s, d) => s + d.tempMaxC, 0) / weatherDays.length;

  return {
    location: `${lat.toFixed(2)}, ${lon.toFixed(2)}`,
    latitude: lat,
    longitude: lon,
    timezone: data.timezone ?? 'UTC',
    daily: weatherDays,
    summary: `Open-Meteo forecast: highs around ${Math.round(avgMax)}°C over ${weatherDays.length} days.`,
  };
}

type OsmElement = {
  id: number;
  type: string;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

async function overpassQuery(query: string): Promise<OsmElement[]> {
  const res = await fetch(OVERPASS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) return [];
  const json = await res.json();
  return (json.elements ?? []) as OsmElement[];
}

function elementCoord(el: OsmElement): { lat: number; lon: number } | null {
  if (el.lat != null && el.lon != null) return { lat: el.lat, lon: el.lon };
  if (el.center) return { lat: el.center.lat, lon: el.center.lon };
  return null;
}

/** Real hotels from OpenStreetMap (names/locations; prices are estimates). */
export async function searchHotelsOsm(
  geo: GeoResult,
  budgetUsd?: number,
): Promise<{ offers: HotelOffer[]; error?: string }> {
  const query = `
[out:json][timeout:25];
(
  node["tourism"="hotel"](around:12000,${geo.lat},${geo.lon});
  way["tourism"="hotel"](around:12000,${geo.lat},${geo.lon});
  node["tourism"="hostel"](around:8000,${geo.lat},${geo.lon});
);
out center 15;
`;
  const elements = await overpassQuery(query);
  if (!elements.length) {
    return {
      offers: [],
      error: 'No hotels found in OpenStreetMap for this area. AI planner will suggest options.',
    };
  }

  const offers: HotelOffer[] = elements.slice(0, 8).map((el, i) => {
    const tags = el.tags ?? {};
    const name = tags.name ?? tags['name:en'] ?? `Hotel ${i + 1}`;
    const stars = tags.stars ? Number(tags.stars) : null;
    const coord = elementCoord(el);
    return {
      id: `${el.type}/${el.id}`,
      name,
      rating: stars && !Number.isNaN(stars) ? stars : null,
      pricePerNightUsd: estimateHotelPriceUsd(stars, budgetUsd),
      imageUrl: null,
      source: 'estimate' as const,
      raw: {
        osm: { type: el.type, id: el.id, tags },
        coord,
        note: 'Price is an estimate; OSM does not provide live rates.',
      },
    };
  });

  return { offers };
}

type AirportPoint = {
  name: string;
  iata: string | null;
  lat: number;
  lon: number;
};

async function findAirportsNear(geo: GeoResult): Promise<AirportPoint[]> {
  const query = `
[out:json][timeout:25];
(
  node["aeroway"="aerodrome"](around:80000,${geo.lat},${geo.lon});
  way["aeroway"="aerodrome"](around:80000,${geo.lat},${geo.lon});
  node["aeroway"="airport"](around:80000,${geo.lat},${geo.lon});
);
out center 8;
`;
  const elements = await overpassQuery(query);
  const airports: AirportPoint[] = [];

  for (const el of elements) {
    const coord = elementCoord(el);
    if (!coord) continue;
    const tags = el.tags ?? {};
    const name = tags.name ?? tags['name:en'] ?? 'Airport';
    const iata = tags.iata ?? tags.icao ?? null;
    airports.push({ name, iata, lat: coord.lat, lon: coord.lon });
  }

  return airports.slice(0, 3);
}

/** Flight options with estimated fares (no paid flight API). */
export async function searchFlightsEstimate(params: {
  originGeo: GeoResult;
  destGeo: GeoResult;
  departDate: string;
  budgetUsd?: number;
}): Promise<{ offers: FlightOffer[]; error?: string }> {
  const [originAirports, destAirports] = await Promise.all([
    findAirportsNear(params.originGeo),
    findAirportsNear(params.destGeo),
  ]);

  if (!originAirports.length || !destAirports.length) {
    const distanceKm = haversineKm(
      params.originGeo.lat,
      params.originGeo.lon,
      params.destGeo.lat,
      params.destGeo.lon,
    );
    const price = estimateFlightPriceUsd(distanceKm);
    const cap = params.budgetUsd
      ? Math.min(price, Math.round(params.budgetUsd * 0.35))
      : price;
    return {
      offers: [
        {
          id: 'estimate-direct',
          airline: 'Estimated carrier',
          route: `${params.originGeo.name} → ${params.destGeo.name}`,
          departTime: '08:30',
          arriveTime: '14:15',
          priceUsd: cap,
          stops: distanceKm > 2500 ? '1+ stops likely' : 'Non-stop (estimate)',
          source: 'estimate',
          raw: {
            distanceKm,
            departDate: params.departDate,
            note: 'Estimated fare — no live booking API configured.',
          },
        },
      ],
    };
  }

  const origin = originAirports[0];
  const dest = destAirports[0];
  const distanceKm = haversineKm(origin.lat, origin.lon, dest.lat, dest.lon);
  const basePrice = estimateFlightPriceUsd(distanceKm);
  const priceUsd = params.budgetUsd
    ? Math.min(basePrice, Math.round(params.budgetUsd * 0.4))
    : basePrice;

  const originCode = origin.iata ?? params.originGeo.name.slice(0, 3).toUpperCase();
  const destCode = dest.iata ?? params.destGeo.name.slice(0, 3).toUpperCase();

  const offers: FlightOffer[] = [
    {
      id: `est-${originCode}-${destCode}`,
      airline: 'Typical airline (estimate)',
      route: `${originCode} → ${destCode}`,
      departTime: '07:00',
      arriveTime: distanceKm > 3000 ? '22:30' : '11:45',
      priceUsd,
      stops: distanceKm > 3500 ? '1 stop (estimate)' : 'Non-stop (estimate)',
      source: 'estimate',
      raw: {
        originAirport: origin.name,
        destAirport: dest.name,
        distanceKm,
        departDate: params.departDate,
        note: 'Estimated using OSM airports + distance heuristic.',
      },
    },
    {
      id: `est-${originCode}-${destCode}-econ`,
      airline: 'Budget option (estimate)',
      route: `${originCode} → ${destCode}`,
      departTime: '13:20',
      arriveTime: distanceKm > 3000 ? '06:10+1' : '18:00',
      priceUsd: Math.round(priceUsd * 0.82),
      stops: distanceKm > 2000 ? '1 stop (estimate)' : 'Non-stop (estimate)',
      source: 'estimate',
      raw: { distanceKm, departDate: params.departDate },
    },
  ];

  return { offers };
}

/** Build travel context string for the LLM from live APIs. */
export async function buildTravelContext(input: {
  destination?: string;
  origin?: string;
  startDate?: string;
  endDate?: string;
  budgetUsd?: number;
  travelers?: number;
}): Promise<string> {
  const parts: string[] = [];
  const dest = input.destination?.trim();
  if (!dest) return '';

  const geo = await geocodeDestination(dest);
  if (geo) {
    parts.push(
      `Destination (Nominatim/OSM): ${geo.displayName} (${geo.lat}, ${geo.lon}), country: ${geo.country}.`,
    );
    const weather = await fetchWeather(geo.lat, geo.lon);
    if (weather) {
      parts.push(`Weather (Open-Meteo): ${weather.summary}`);
      const sample = weather.daily.slice(0, 3).map(
        (d) =>
          `${d.date}: ${Math.round(d.tempMinC)}–${Math.round(d.tempMaxC)}°C, rain ${d.precipitationMm}mm`,
      );
      parts.push(`Daily sample: ${sample.join('; ')}`);
    }

    const hotels = await searchHotelsOsm(geo, input.budgetUsd);
    if (hotels.offers.length) {
      parts.push(
        'Hotels (OpenStreetMap names + estimated nightly USD): ' +
          hotels.offers
            .map(
              (h) =>
                `${h.name}${h.rating ? ` ★${h.rating}` : ''} ~$${h.pricePerNightUsd ?? '?'}/night (estimate)`,
            )
            .join('; '),
      );
    } else if (hotels.error) {
      parts.push(`Hotels note: ${hotels.error}`);
    }

    if (input.origin && input.startDate) {
      const originGeo = await geocodeDestination(input.origin);
      if (originGeo) {
        const flights = await searchFlightsEstimate({
          originGeo,
          destGeo: geo,
          departDate: input.startDate,
          budgetUsd: input.budgetUsd,
        });
        if (flights.offers.length) {
          parts.push(
            'Flights (estimated fares, not live bookings): ' +
              flights.offers
                .map(
                  (f) =>
                    `${f.airline} ${f.route} ${f.departTime}-${f.arriveTime} ~$${f.priceUsd ?? '?'} (${f.stops})`,
                )
                .join('; '),
          );
        } else if (flights.error) {
          parts.push(`Flights note: ${flights.error}`);
        }
      }
    }
  }

  if (input.budgetUsd) parts.push(`Budget cap: $${input.budgetUsd} USD.`);
  if (input.travelers) parts.push(`Travelers: ${input.travelers}.`);

  return parts.join('\n');
}
