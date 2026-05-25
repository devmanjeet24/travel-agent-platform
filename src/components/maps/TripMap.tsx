import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { MapPin } from 'lucide-react-native';
import Svg, { Polyline } from 'react-native-svg';

import { type TripAttraction } from '@/constants/trip-attractions';
import {
  isValidCoordinate,
  sanitizeMapRegion,
  zoomFromRegion,
} from '@/lib/map-coordinates';
import { buildOsmTileLayout } from '@/lib/osm-map';
import {
  fetchDrivingRoute,
  formatDistance,
  formatDuration,
  type LatLng,
} from '@/services/osrm.service';
import { brand } from '@/constants/design';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type Props = {
  attractions?: TripAttraction[];
  initialRegion?: MapRegion;
};

type MapSize = {
  width: number;
  height: number;
};

type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

const EMPTY_MAP_REGION: MapRegion = {
  latitude: 0,
  longitude: 0,
  latitudeDelta: 1,
  longitudeDelta: 1,
};

function filterValidAttractions(attractions: TripAttraction[]): TripAttraction[] {
  return attractions.filter((a) =>
    isValidCoordinate(a.coordinate.latitude, a.coordinate.longitude),
  );
}

function waypointKey(points: LatLng[]): string {
  return points
    .map((point) => `${point.latitude.toFixed(6)},${point.longitude.toFixed(6)}`)
    .join('|');
}

function waypointsFromKey(key: string): LatLng[] {
  if (!key) return [];
  return key.split('|').map((point) => {
    const [latitude, longitude] = point.split(',').map(Number);
    return { latitude, longitude };
  });
}

function haversineMeters(a: LatLng, b: LatLng): number {
  const earthRadiusMeters = 6_371_000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function dedupeRouteWaypoints(points: LatLng[]): LatLng[] {
  const deduped: LatLng[] = [];
  for (const point of points) {
    if (!deduped.some((existing) => haversineMeters(existing, point) < 25)) {
      deduped.push(point);
    }
  }
  return deduped;
}

function webMercatorPixel(
  coordinate: LatLng,
  zoom: number,
): { x: number; y: number } {
  const scale = 256 * 2 ** zoom;
  const latitude = Math.max(
    -85.05112878,
    Math.min(85.05112878, coordinate.latitude),
  );
  const sinLatitude = Math.sin((latitude * Math.PI) / 180);

  return {
    x: ((coordinate.longitude + 180) / 360) * scale,
    y:
      (0.5 -
        Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI)) *
      scale,
  };
}

function projectToMap(
  coordinate: LatLng,
  center: LatLng,
  zoom: number,
  size: MapSize,
): { x: number; y: number } {
  const projected = webMercatorPixel(coordinate, zoom);
  const projectedCenter = webMercatorPixel(center, zoom);

  return {
    x: projected.x - projectedCenter.x + size.width / 2,
    y: projected.y - projectedCenter.y + size.height / 2,
  };
}

export function TripMap({
  attractions = [],
  initialRegion = EMPTY_MAP_REGION,
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
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState<LatLng[]>([]);
  const [routeNotice, setRouteNotice] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [mapSize, setMapSize] = useState<MapSize | null>(null);
  const [, setFailedTileUrls] = useState<Set<string>>(() => new Set());

  const center = useMemo(
    () => ({
      latitude: region.latitude,
      longitude: region.longitude,
    }),
    [region.latitude, region.longitude],
  );
  const staticMapSize = mapSize ?? { width: 640, height: 400 };
  const zoom = useMemo(
    () =>
      zoomFromRegion(
        region.latitudeDelta,
        region.longitudeDelta,
        staticMapSize.width,
        staticMapSize.height,
      ),
    [
      region.latitudeDelta,
      region.longitudeDelta,
      staticMapSize.height,
      staticMapSize.width,
    ],
  );
  const routeKey = useMemo(
    () =>
      waypointKey(dedupeRouteWaypoints(validAttractions.map((a) => a.coordinate))),
    [validAttractions],
  );
  const routeWaypoints = useMemo(() => waypointsFromKey(routeKey), [routeKey]);
  const displayRouteCoordinates = useMemo(
    () =>
      routeCoordinates.length >= 2
        ? routeCoordinates
        : routeWaypoints.length >= 2
          ? routeWaypoints
          : [],
    [routeCoordinates, routeWaypoints],
  );

  const mapTiles = useMemo(
    () =>
      buildOsmTileLayout({
        center,
        zoom,
        width: Math.max(1, Math.round(staticMapSize.width)),
        height: Math.max(1, Math.round(staticMapSize.height)),
      }),
    [
      center,
      staticMapSize.height,
      staticMapSize.width,
      zoom,
    ],
  );
  const mapTileUrls = useMemo(() => mapTiles.map((tile) => tile.url), [mapTiles]);

  const routePolyline = useMemo(() => {
    if (!mapSize || displayRouteCoordinates.length < 2) return '';

    return displayRouteCoordinates
      .filter((coordinate) =>
        isValidCoordinate(coordinate.latitude, coordinate.longitude),
      )
      .map((coordinate) => projectToMap(coordinate, center, zoom, mapSize))
      .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
      .join(' ');
  }, [center, displayRouteCoordinates, mapSize, zoom]);

  const handleMapLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width <= 0 || height <= 0) return;

    setMapSize((current) => {
      if (
        current &&
        Math.abs(current.width - width) < 1 &&
        Math.abs(current.height - height) < 1
      ) {
        return current;
      }
      return { width, height };
    });
  }, []);

  useEffect(() => {
    console.debug('[TripMap] coordinates passed to map', {
      region,
      zoom,
      attractions: validAttractions.map((attraction) => ({
        id: attraction.id,
        title: attraction.title,
        latitude: attraction.coordinate.latitude,
        longitude: attraction.coordinate.longitude,
      })),
      routeWaypoints,
    });
  }, [region, routeWaypoints, validAttractions, zoom]);

  useEffect(() => {
    console.debug('[TripMap] OSM tile image URLs', {
      count: mapTileUrls.length,
      urls: mapTileUrls.slice(0, 6),
    });
    setPreviewFailed(false);
    setFailedTileUrls(new Set());
  }, [mapTileUrls]);

  useEffect(() => {
    if (!mapSize) return;
    const outsideMarkers = validAttractions
      .map((attraction) => ({
        title: attraction.title,
        point: projectToMap(attraction.coordinate, center, zoom, mapSize),
      }))
      .filter(
        ({ point }) =>
          point.x < 0 ||
          point.x > mapSize.width ||
          point.y < 0 ||
          point.y > mapSize.height,
      );
    if (outsideMarkers.length) {
      console.warn('[TripMap] markers outside map bounds', outsideMarkers);
    }
  }, [center, mapSize, validAttractions, zoom]);

  const handleTileError = useCallback(
    (url: string) => {
      setFailedTileUrls((current) => {
        if (current.has(url)) return current;
        const next = new Set(current);
        next.add(url);
        console.warn('[TripMap] OSM tile image failed', {
          url,
          failedCount: next.size,
          tileCount: mapTileUrls.length,
        });
        if (mapTileUrls.length > 0 && next.size >= mapTileUrls.length) {
          console.warn('[TripMap] previewFailed=true', {
            reason: 'all OSM tile images failed',
            failedUrls: Array.from(next),
          });
          setPreviewFailed(true);
        }
        return next;
      });
    },
    [mapTileUrls],
  );

  useEffect(() => {
    if (routeWaypoints.length < 2) {
      console.debug('[TripMap] skipping OSRM route fetch', {
        reason: 'fewer than two distinct valid waypoints',
        routeWaypoints,
      });
      setRouteMeta(null);
      setRouteCoordinates([]);
      setRouteNotice('Add at least two geocoded stops to show a route.');
      setLoadingRoute(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoadingRoute(true);
      setRouteNotice(null);
      try {
        console.debug('[TripMap] fetching OSRM route', { routeWaypoints });
        const route = await fetchDrivingRoute(routeWaypoints);
        if (cancelled) return;
        if (route) {
          console.debug('[TripMap] OSRM route accepted', {
            distanceMeters: route.distanceMeters,
            durationSeconds: route.durationSeconds,
            coordinateCount: route.coordinates.length,
          });
          setRouteMeta({
            distance: formatDistance(route.distanceMeters),
            duration: formatDuration(route.durationSeconds),
          });
          setRouteCoordinates(route.coordinates);
          setRouteNotice(null);
        } else {
          console.warn('[TripMap] OSRM route unavailable', { routeWaypoints });
          setRouteMeta(null);
          setRouteCoordinates(routeWaypoints);
          setRouteNotice('Driving route unavailable; showing a direct line between stops.');
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('[TripMap] OSRM route fetch threw', {
            error: error instanceof Error ? error.message : String(error),
            routeWaypoints,
          });
          setRouteMeta(null);
          setRouteCoordinates(routeWaypoints);
          setRouteNotice('Driving route unavailable; showing a direct line between stops.');
        }
      } finally {
        if (!cancelled) {
          setLoadingRoute(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [routeWaypoints]);

  if (!validAttractions.length) {
    return (
      <View className="flex-1 min-h-[280px] rounded-2xl overflow-hidden mb-3">
        <View
          className={`${theme.bgMuted} flex-1 items-center justify-center px-6`}
        >
          <MapPin size={40} color={brand.primaryDark} />
          <Text className={`${theme.text} font-semibold mt-3`}>
            No map points yet
          </Text>
          <Text className={`${theme.textMuted} text-sm mt-2 text-center`}>
            Add geocoded stops to show an OpenStreetMap preview here.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <View
        onLayout={handleMapLayout}
        className="flex-1 min-h-[280px] rounded-2xl overflow-hidden mb-3"
      >
        {!previewFailed ? (
          <View style={StyleSheet.absoluteFill}>
            {mapTiles.map((tile) => (
              <Image
                key={tile.key}
                source={{ uri: tile.url }}
                style={[
                  styles.tile,
                  {
                    left: tile.left,
                    top: tile.top,
                    width: tile.size,
                    height: tile.size,
                  },
                ]}
                contentFit="cover"
                transition={120}
                onError={() => handleTileError(tile.url)}
              />
            ))}
          </View>
        ) : (
          <View
            className={`${theme.bgMuted} flex-1 min-h-[280px] items-center justify-center px-6`}
          >
            <MapPin size={40} color={brand.primaryDark} />
            <Text className={`${theme.text} font-semibold mt-3`}>
              Map preview unavailable
            </Text>
            <Text className={`${theme.textMuted} text-sm mt-2 text-center`}>
              {validAttractions.length} location
              {validAttractions.length === 1 ? '' : 's'} on this trip
            </Text>
          </View>
        )}

        {routePolyline ? (
          <Svg pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Polyline
              points={routePolyline}
              fill="none"
              stroke="rgba(255,255,255,0.85)"
              strokeWidth={7}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Polyline
              points={routePolyline}
              fill="none"
              stroke={brand.primaryDark}
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        ) : null}

        {validAttractions.slice(0, 12).map((attraction, index) => {
              const point = mapSize
                ? projectToMap(attraction.coordinate, center, zoom, mapSize)
                : null;
              if (!point) return null;
              return (
                <View
                  key={attraction.id}
                  pointerEvents="none"
                  style={[
                    styles.marker,
                    {
                      left: point.x - 10,
                      top: point.y - 20,
                    },
                  ]}
                >
                  <Text style={styles.markerText}>{index + 1}</Text>
                </View>
              );
            })}

        <View className="absolute bottom-0 left-0 right-0 bg-black/50 px-3 py-2">
          <Text className="text-white text-sm font-medium">
            Map route preview
          </Text>
        </View>

        {loadingRoute ? (
          <View className="absolute inset-0 items-center justify-center bg-black/20">
            <ActivityIndicator color="#fff" />
          </View>
        ) : null}
      </View>

      {routeMeta ? (
        <Text className={`${theme.textMuted} text-sm mb-2 px-1`}>
          Route: {routeMeta.distance} · ~{routeMeta.duration} driving (OSRM)
        </Text>
      ) : null}

      {routeNotice ? (
        <Text className={`${theme.textMuted} text-sm mb-2 px-1`}>
          {routeNotice}
        </Text>
      ) : null}

      <Text className={`${theme.textMuted} text-xs mb-3 px-1`}>
        © OpenStreetMap contributors · Tiles by CARTO · Routing via OSRM
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
  const query = encodeURIComponent(`${latitude},${longitude}`);
  void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
}

const styles = StyleSheet.create({
  tile: {
    position: 'absolute',
  },
  marker: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: brand.primaryDark,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
});

export default TripMap;
