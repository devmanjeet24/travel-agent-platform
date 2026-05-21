import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'

import {
  AttractionRow,
  openAttractionInMaps,
  TripMap,
} from '@/components/maps/TripMap'
import { demoMapRegion } from '@/constants/trip-attractions'
import { useTripItineraryQuery, useTripQuery } from '@/hooks/trips/use-trip-query'
import { itineraryToAttractions, regionFromAttractions } from '@/utils/itinerary-map'
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

  const region =
    regionFromAttractions(attractions) ??
    (trip?.destination_lat != null
      ? {
          latitude: trip.destination_lat,
          longitude: trip.destination_lon!,
          latitudeDelta: 0.35,
          longitudeDelta: 0.35,
        }
      : demoMapRegion)

  if (isLoading) {
    return (
      <View className={`flex-1 ${theme.bg} items-center justify-center`}>
        <ActivityIndicator color="#0EA5E9" />
      </View>
    )
  }

  if (!attractions.length) {
    return (
      <View className={`flex-1 ${theme.bg} px-5 justify-center`}>
        <Text className={`${theme.textMuted} text-center leading-6`}>
          No map points yet. Regenerate your AI plan or open a trip with a geocoded destination.
        </Text>
      </View>
    )
  }

  return (
    <ScrollView
      className={`flex-1 ${theme.bg}`}
      contentContainerClassName="px-5 pb-8 pt-2"
      showsVerticalScrollIndicator={false}
    >
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
    </ScrollView>
  )
}
