import { ActivityIndicator, Text, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'

import {
  AttractionRow,
  openAttractionInMaps,
  TripMap,
} from '@/components/maps/TripMap'
import TripScreenWrapper from '@/components/trip/TripScreenWrapper'
import { demoMapRegion } from '@/constants/trip-attractions'
import { useTripItineraryQuery, useTripQuery } from '@/hooks/trips/use-trip-query'
import { sanitizeMapRegion } from '@/lib/map-coordinates'
import { itineraryToAttractions, regionFromAttractions } from '@/utils/itinerary-map'
import { brand } from '@/constants/design'
import { useThemedStyles } from '@/hooks/use-themed-styles'

export default function MapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const theme = useThemedStyles()
  const { data: trip } = useTripQuery(id)
  const { data: itinerary, isLoading } = useTripItineraryQuery(id)

  const fromItinerary = itinerary ? itineraryToAttractions(itinerary) : []
  const attractions =
    fromItinerary.length > 0
      ? fromItinerary
      : trip?.destination_lat != null && trip.destination_lon != null
        ? [
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
        : []

  const region = sanitizeMapRegion(
    regionFromAttractions(attractions) ??
      (trip?.destination_lat != null && trip.destination_lon != null
        ? {
            latitude: trip.destination_lat,
            longitude: trip.destination_lon,
            latitudeDelta: 0.35,
            longitudeDelta: 0.35,
          }
        : demoMapRegion),
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
