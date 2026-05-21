import type { ItineraryActivityRow, ItineraryDayRow } from '@/types/database';
import type { TripAttraction } from '@/constants/trip-attractions';

export function itineraryToAttractions(
  days: Array<ItineraryDayRow & { activities: ItineraryActivityRow[] }>,
): TripAttraction[] {
  const attractions: TripAttraction[] = [];
  for (const day of days) {
    for (const act of day.activities) {
      if (act.latitude != null && act.longitude != null) {
        attractions.push({
          id: act.id,
          title: act.name,
          subtitle: `Day ${day.day_number} · ${act.activity_time ?? ''}`,
          coordinate: {
            latitude: act.latitude,
            longitude: act.longitude,
          },
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
  if (!attractions.length) return null;
  const lats = attractions.map((a) => a.coordinate.latitude);
  const lons = attractions.map((a) => a.coordinate.longitude);
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
