import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { MapPin } from 'lucide-react-native';

import {
  demoBaliAttractions,
  demoMapRegion,
  type TripAttraction,
} from '@/constants/trip-attractions';
import { isValidCoordinate, sanitizeMapRegion } from '@/lib/map-coordinates';
import { buildOsmStaticMapUrl, openOsmOverviewUrl } from '@/lib/osm-map';
import {
  fetchDrivingRoute,
  formatDistance,
  formatDuration,
  mapsNavigationUrl,
} from '@/services/osrm.service';
import { brand } from '@/constants/design';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type Props = {
  attractions?: TripAttraction[];
  initialRegion?: typeof demoMapRegion;
};

function filterValidAttractions(attractions: TripAttraction[]): TripAttraction[] {
  return attractions.filter((a) =>
    isValidCoordinate(a.coordinate.latitude, a.coordinate.longitude),
  );
}

export function TripMap({
  attractions = demoBaliAttractions,
  initialRegion = demoMapRegion,
}: Props) {
  const theme = useThemedStyles();
  const region = useMemo(
    () => sanitizeMapRegion(initialRegion),
    [initialRegion],
  );
  const validAttractions = useMemo(
    () => filterValidAttractions(attractions),
    [attractions],
  );

  const [routeMeta, setRouteMeta] = useState<{
    distance: string;
    duration: string;
  } | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(validAttractions.length >= 2);
  const [previewFailed, setPreviewFailed] = useState(false);

  const center = useMemo(
    () => ({
      latitude: region.latitude,
      longitude: region.longitude,
    }),
    [region.latitude, region.longitude],
  );

  const staticMapUri = useMemo(
    () =>
      buildOsmStaticMapUrl({
        center,
        latitudeDelta: region.latitudeDelta,
        markers: validAttractions.map((a) => a.coordinate),
      }),
    [center, region.latitudeDelta, validAttractions],
  );

  useEffect(() => {
    setPreviewFailed(false);
  }, [staticMapUri]);

  useEffect(() => {
    if (validAttractions.length < 2) {
      setRouteMeta(null);
      setLoadingRoute(false);
      return;
    }

    let cancelled = false;
    const waypoints = validAttractions.map((a) => a.coordinate);

    (async () => {
      setLoadingRoute(true);
      const route = await fetchDrivingRoute(waypoints);
      if (cancelled) return;
      if (route) {
        setRouteMeta({
          distance: formatDistance(route.distanceMeters),
          duration: formatDuration(route.durationSeconds),
        });
      } else {
        setRouteMeta(null);
      }
      setLoadingRoute(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [validAttractions]);

  const openOverview = () => {
    void Linking.openURL(openOsmOverviewUrl(center, region.latitudeDelta));
  };

  if (!validAttractions.length) {
    return (
      <View className="flex-1 min-h-[280px] rounded-2xl overflow-hidden mb-3">
        <Pressable
          onPress={openOverview}
          className={`${theme.bgMuted} flex-1 items-center justify-center px-6`}
        >
          <MapPin size={40} color={brand.primaryDark} />
          <Text className={`${theme.text} font-semibold mt-3`}>
            View on OpenStreetMap
          </Text>
          <Text className={`${theme.textMuted} text-sm mt-2 text-center`}>
            Tap to open the map in your browser.
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <Pressable
        onPress={openOverview}
        className="flex-1 min-h-[280px] rounded-2xl overflow-hidden mb-3"
        accessibilityRole="button"
        accessibilityLabel="Open trip map on OpenStreetMap"
      >
        {!previewFailed ? (
          <Image
            source={{ uri: staticMapUri }}
            style={{ width: '100%', height: '100%', minHeight: 280 }}
            contentFit="cover"
            transition={200}
            onError={() => setPreviewFailed(true)}
          />
        ) : (
          <View
            className={`${theme.bgMuted} flex-1 min-h-[280px] items-center justify-center px-6`}
          >
            <MapPin size={40} color={brand.primaryDark} />
            <Text className={`${theme.text} font-semibold mt-3`}>
              View on OpenStreetMap
            </Text>
            <Text className={`${theme.textMuted} text-sm mt-2 text-center`}>
              {validAttractions.length} location
              {validAttractions.length === 1 ? '' : 's'} on this trip
            </Text>
          </View>
        )}

        <View className="absolute bottom-0 left-0 right-0 bg-black/50 px-3 py-2">
          <Text className="text-white text-sm font-medium">
            Tap to open interactive map
          </Text>
        </View>

        {loadingRoute ? (
          <View className="absolute inset-0 items-center justify-center bg-black/20">
            <ActivityIndicator color="#fff" />
          </View>
        ) : null}
      </Pressable>

      {routeMeta ? (
        <Text className={`${theme.textMuted} text-sm mb-2 px-1`}>
          Route: {routeMeta.distance} · ~{routeMeta.duration} driving (OSRM)
        </Text>
      ) : null}

      <Text className={`${theme.textMuted} text-xs mb-3 px-1`}>
        © OpenStreetMap contributors · Routing via OSRM
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
  const { latitude, longitude } = attraction.coordinate;
  if (!isValidCoordinate(latitude, longitude)) return;
  void Linking.openURL(mapsNavigationUrl(latitude, longitude));
}

export default TripMap;
