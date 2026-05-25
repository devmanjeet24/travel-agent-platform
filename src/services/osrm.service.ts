import { env } from '@/lib/env';
import { isValidCoordinate } from '@/lib/map-coordinates';

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
  const validWaypoints = waypoints.filter((point) =>
    isValidCoordinate(point.latitude, point.longitude),
  );
  if (validWaypoints.length < 2) {
    console.debug('[OSRM] route skipped', {
      reason: 'fewer than two valid coordinates',
      waypoints,
    });
    return null;
  }

  const coords = validWaypoints
    .map((p) => `${p.longitude},${p.latitude}`)
    .join(';');
  const url = `${env.osrmBaseUrl}/route/v1/driving/${coords}?overview=full&geometries=geojson`;

  const res = await fetch(url);
  const responseText = await res.text();
  console.debug('[OSRM] response', {
    url,
    status: res.status,
    ok: res.ok,
    body: responseText.slice(0, 600),
  });
  if (!res.ok) return null;

  const data = JSON.parse(responseText) as OsrmGeoJsonResponse;
  if (data.code && data.code !== 'Ok') {
    console.warn('[OSRM] non-OK route response', data);
    return null;
  }
  const route = data.routes?.[0];
  if (!route) {
    console.warn('[OSRM] no route in response', data);
    return null;
  }
  if (route.distance < 1 || route.geometry.coordinates.length < 2) {
    console.warn('[OSRM] route rejected as empty', {
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      coordinateCount: route.geometry.coordinates.length,
      validWaypoints,
    });
    return null;
  }

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
