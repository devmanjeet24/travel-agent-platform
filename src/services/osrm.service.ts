import { env } from '@/lib/env';

export type LatLng = { latitude: number; longitude: number };

export type RouteResult = {
  coordinates: LatLng[];
  distanceMeters: number;
  durationSeconds: number;
};

type OsrmGeoJsonResponse = {
  routes?: Array<{
    distance: number;
    duration: number;
    geometry: { coordinates: [number, number][] };
  }>;
  code?: string;
  message?: string;
};

/** Fetch a driving route through waypoints using OSRM (OpenStreetMap routing). */
export async function fetchDrivingRoute(
  waypoints: LatLng[],
): Promise<RouteResult | null> {
  if (waypoints.length < 2) return null;

  const coords = waypoints
    .map((p) => `${p.longitude},${p.latitude}`)
    .join(';');
  const url = `${env.osrmBaseUrl}/route/v1/driving/${coords}?overview=full&geometries=geojson`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const data = (await res.json()) as OsrmGeoJsonResponse;
  const route = data.routes?.[0];
  if (!route) return null;

  return {
    coordinates: route.geometry.coordinates.map(([longitude, latitude]) => ({
      latitude,
      longitude,
    })),
    distanceMeters: route.distance,
    durationSeconds: route.duration,
  };
}

export function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/** Open native maps app at a coordinate (no API key). */
export function mapsNavigationUrl(latitude: number, longitude: number): string {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=15/${latitude}/${longitude}`;
}
