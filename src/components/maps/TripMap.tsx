import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  Text,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, UrlTile } from 'react-native-maps';

import {
  demoBaliAttractions,
  demoMapRegion,
  type TripAttraction,
} from '@/constants/trip-attractions';
import { getMapTileUrl } from '@/lib/env';
import {
  fetchDrivingRoute,
  formatDistance,
  formatDuration,
  mapsNavigationUrl,
  type LatLng,
} from '@/services/osrm.service';
import { brand } from '@/constants/design';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type Props = {
  attractions?: TripAttraction[];
  initialRegion?: typeof demoMapRegion;
};

export function TripMap({
  attractions = demoBaliAttractions,
  initialRegion = demoMapRegion,
}: Props) {
  const theme = useThemedStyles();
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);
  const [routeMeta, setRouteMeta] = useState<{
    distance: string;
    duration: string;
  } | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const waypoints = attractions.map((a) => a.coordinate);

    (async () => {
      setLoadingRoute(true);
      const route = await fetchDrivingRoute(waypoints);
      if (cancelled) return;
      if (route) {
        setRouteCoords(route.coordinates);
        setRouteMeta({
          distance: formatDistance(route.distanceMeters),
          duration: formatDuration(route.durationSeconds),
        });
      }
      setLoadingRoute(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [attractions]);

  const tileUrl = getMapTileUrl();

  return (
    <View className="flex-1">
      <View className="flex-1 min-h-[280px] rounded-2xl overflow-hidden mb-3">
        <MapView
          style={{ flex: 1 }}
          initialRegion={initialRegion}
          showsUserLocation={false}
          showsCompass
        >
          <UrlTile
            urlTemplate={tileUrl}
            maximumZ={19}
            flipY={false}
            zIndex={-1}
          />
          {routeCoords.length > 0 ? (
            <Polyline
              coordinates={routeCoords}
              strokeColor={brand.primaryDark}
              strokeWidth={4}
            />
          ) : null}
          {attractions.map((a) => (
            <Marker
              key={a.id}
              coordinate={a.coordinate}
              title={a.title}
              description={a.subtitle}
            />
          ))}
        </MapView>
        {loadingRoute ? (
          <View className="absolute inset-0 items-center justify-center bg-black/20">
            <ActivityIndicator color={brand.primaryDark} />
          </View>
        ) : null}
      </View>

      {routeMeta ? (
        <Text className={`${theme.textMuted} text-sm mb-2 px-1`}>
          Route: {routeMeta.distance} · ~{routeMeta.duration} driving
        </Text>
      ) : null}

      <Text className={`${theme.textMuted} text-xs mb-3 px-1`}>
        © OpenStreetMap contributors
      </Text>
    </View>
  );
}

export function AttractionRow({
  attraction,
  onNavigate,
}: {
  attraction: TripAttraction;
  onNavigate?: () => void;
}) {
  const theme = useThemedStyles();

  return (
    <Pressable
      onPress={onNavigate}
      className={`${theme.bgCard} rounded-2xl p-4 mb-3 border ${theme.border}`}
    >
      <Text className={`${theme.text} font-semibold`}>{attraction.title}</Text>
      <Text className={`${theme.textMuted} text-sm mt-1`}>
        {attraction.subtitle}
      </Text>
      <Text className="text-yellow-600 text-sm mt-2 font-medium">
        Open in map →
      </Text>
    </Pressable>
  );
}

export function openAttractionInMaps(attraction: TripAttraction) {
  const url = mapsNavigationUrl(
    attraction.coordinate.latitude,
    attraction.coordinate.longitude,
  );
  void Linking.openURL(url);
}

export default TripMap;
