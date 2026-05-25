import { useMemo } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'

import {
  AttractionRow,
  openAttractionInMaps,
  TripMap,
} from '@/components/maps/TripMap'
import TripScreenWrapper from '@/components/trip/TripScreenWrapper'
import { useTripItineraryQuery, useTripQuery } from '@/hooks/trips/use-trip-query'
import type { TripAttraction } from '@/constants/trip-attractions'
import { isValidCoordinate, sanitizeMapRegion } from '@/lib/map-coordinates'
import { itineraryToAttractions, regionFromAttractions } from '@/utils/itinerary-map'
import { brand } from '@/constants/design'
import { useThemedStyles } from '@/hooks/use-themed-styles'

const EMPTY_MAP_REGION = {
  latitude: 0,
  longitude: 0,
  latitudeDelta: 1,
  longitudeDelta: 1,
}

function mergeMapAttractions(
  destinationAttractions: TripAttraction[],
  itineraryAttractions: TripAttraction[],
) {
  const seen = new Set<string>()
  return [...destinationAttractions, ...itineraryAttractions].filter((attraction) => {
    const key = `${attraction.coordinate.latitude.toFixed(5)},${attraction.coordinate.longitude.toFixed(5)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export default function MapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const theme = useThemedStyles()
  const { data: trip } = useTripQuery(id)
  const { data: itinerary, isLoading } = useTripItineraryQuery(id)

  const fromItinerary = useMemo(
    () => (itinerary ? itineraryToAttractions(itinerary) : []),
    [itinerary],
  )
  const destinationAttractions = useMemo(() => {
    if (
      trip?.destination_lat == null ||
      trip.destination_lon == null ||
      !isValidCoordinate(trip.destination_lat, trip.destination_lon)
    ) {
      return []
    }

    return [
      {
        id: 'dest',
        title: trip.destination,
        subtitle: 'Destination',
        coordinate: {
          latitude: trip.destination_lat,
          longitude: trip.destination_lon,
        },
      },
    ]
  }, [trip?.destination, trip?.destination_lat, trip?.destination_lon])
  const attractions = useMemo(
    () => mergeMapAttractions(destinationAttractions, fromItinerary),
    [destinationAttractions, fromItinerary],
  )

  const region = useMemo(
    () =>
      sanitizeMapRegion(
        regionFromAttractions(attractions) ??
          (destinationAttractions[0]
            ? {
                latitude: destinationAttractions[0].coordinate.latitude,
                longitude: destinationAttractions[0].coordinate.longitude,
                latitudeDelta: 0.35,
                longitudeDelta: 0.35,
              }
            : EMPTY_MAP_REGION),
      ),
    [attractions, destinationAttractions],
  )

  if (isLoading) {
    return (
      <TripScreenWrapper scroll={false} centered className={theme.bg}>
        <ActivityIndicator color={brand.primaryDark} />
      </TripScreenWrapper>
    )
  }

  if (!attractions.length) {
    return (
      <TripScreenWrapper centered className={theme.bg}>
        <Text className={`${theme.textMuted} text-center leading-6`}>
          No map points yet. Regenerate your AI plan or open a trip with a geocoded destination.
        </Text>
      </TripScreenWrapper>
    )
  }

  return (
    <TripScreenWrapper className={theme.bg}>
      <View className="h-[360px]">
        <TripMap attractions={attractions} initialRegion={region} />
      </View>

      {attractions.map((a) => (
        <AttractionRow
          key={a.id}
          attraction={a}
          onNavigate={() => openAttractionInMaps(a)}
        />
      ))}
    </TripScreenWrapper>
  )
}
