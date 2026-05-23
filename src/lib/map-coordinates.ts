export function isValidCoordinate(lat: number, lon: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return false;
  if (Math.abs(lat) < 0.0001 && Math.abs(lon) < 0.0001) return false;
  return true;
}

export function sanitizeMapRegion(region: {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}): {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
} {
  const latitude = Number.isFinite(region.latitude) ? region.latitude : 0;
  const longitude = Number.isFinite(region.longitude) ? region.longitude : 0;
  const latitudeDelta = Math.min(
    90,
    Math.max(0.02, Number.isFinite(region.latitudeDelta) ? region.latitudeDelta : 0.35),
  );
  const longitudeDelta = Math.min(
    180,
    Math.max(0.02, Number.isFinite(region.longitudeDelta) ? region.longitudeDelta : 0.35),
  );
  return { latitude, longitude, latitudeDelta, longitudeDelta };
}

export function zoomFromLatitudeDelta(latitudeDelta: number): number {
  const delta = Math.max(0.02, latitudeDelta);
  const zoom = Math.round(Math.log2(360 / delta)) - 1;
  return Math.min(16, Math.max(4, zoom));
}
