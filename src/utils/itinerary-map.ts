import type { ItineraryActivityRow, ItineraryDayRow } from '@/types/database';
import type { TripAttraction } from '@/constants/trip-attractions';
import { isValidCoordinate } from '@/lib/map-coordinates';

export function itineraryToAttractions(
  days: Array<ItineraryDayRow & { activities: ItineraryActivityRow[] }>,
): TripAttraction[] {
  const attractions: TripAttraction[] = [];
  for (const day of days) {
    for (const act of day.activities) {
      if (act.latitude != null && act.longitude != null) {
        const latitude = Number(act.latitude);
        const longitude = Number(act.longitude);
        if (!isValidCoordinate(latitude, longitude)) continue;
        attractions.push({
          id: act.id,
          title: act.name,
          subtitle: `Day ${day.day_number} · ${act.activity_time ?? ''}`,
          coordinate: { latitude, longitude },
        });
      }
    }
  }
  return attractions;
}

export function regionFromAttractions(
  attractions: TripAttraction[],
): {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
} | null {
  const valid = attractions.filter((a) =>
    isValidCoordinate(a.coordinate.latitude, a.coordinate.longitude),
  );
  if (!valid.length) return null;
  const lats = valid.map((a) => a.coordinate.latitude);
  const lons = valid.map((a) => a.coordinate.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
    latitudeDelta: Math.max(0.08, (maxLat - minLat) * 1.4),
    longitudeDelta: Math.max(0.08, (maxLon - minLon) * 1.4),
  };
}
