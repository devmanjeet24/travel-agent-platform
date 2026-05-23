import { isValidCoordinate, zoomFromLatitudeDelta } from '@/lib/map-coordinates';

type LatLon = { latitude: number; longitude: number };

/** Free OSM static map preview (no API key). */
export function buildOsmStaticMapUrl(params: {
  center: LatLon;
  latitudeDelta?: number;
  markers: LatLon[];
  width?: number;
  height?: number;
}): string {
  const width = params.width ?? 640;
  const height = params.height ?? 400;
  const zoom = zoomFromLatitudeDelta(params.latitudeDelta ?? 0.35);
  const markerParam = params.markers
    .filter((m) => isValidCoordinate(m.latitude, m.longitude))
    .slice(0, 12)
    .map((m) => `${m.latitude},${m.longitude},red-pushpin`)
    .join('|');

  const query = new URLSearchParams({
    center: `${params.center.latitude},${params.center.longitude}`,
    zoom: String(zoom),
    size: `${width}x${height}`,
    maptype: 'mapnik',
  });
  if (markerParam) query.set('markers', markerParam);

  return `https://staticmap.openstreetmap.de/staticmap.php?${query.toString()}`;
}

/** Open the area in openstreetmap.org (in-app browser or external). */
export function openOsmOverviewUrl(center: LatLon, latitudeDelta = 0.35): string {
  const zoom = zoomFromLatitudeDelta(latitudeDelta);
  const { latitude, longitude } = center;
  return `https://www.openstreetmap.org/#map=${zoom}/${latitude}/${longitude}`;
}
