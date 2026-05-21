import { ActivityIndicator, Alert, Image, Text, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { Star } from 'lucide-react-native'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useTripHotelsQuery, useTripQuery } from '@/hooks/trips/use-trip-query'
import { tripKeys } from '@/services/trips/trip-keys'
import { searchAndCacheHotels } from '@/services/travel/travel-api'
import { useThemedStyles } from '@/hooks/use-themed-styles'

export default function HotelsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const theme = useThemedStyles()
  const queryClient = useQueryClient()
  const { data: trip } = useTripQuery(id)
  const { data: hotels, isLoading } = useTripHotelsQuery(id)

  const refresh = async () => {
    if (!trip?.start_date || !trip.end_date) {
      Alert.alert('Dates required', 'Add trip dates to search hotels.')
      return
    }
    try {
      await searchAndCacheHotels({
        tripId: trip.id,
        destination: trip.destination,
        startDate: trip.start_date,
        endDate: trip.end_date,
      })
      void queryClient.invalidateQueries({ queryKey: tripKeys.hotels(trip.id) })
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Search failed')
    }
  }

  return (
    <View className={`flex-1 ${theme.bg} px-5 pb-8`}>
      <Button title="Search hotels (OpenStreetMap)" variant="outline" onPress={refresh} />

      {isLoading ? (
        <ActivityIndicator className="mt-8" color="#0EA5E9" />
      ) : !hotels?.length ? (
        <Text className={`${theme.textMuted} mt-6 text-center`}>
          No hotels cached. Tap search to load real hotel names from OpenStreetMap (prices are estimates).
        </Text>
      ) : (
        hotels.map((h) => (
          <Card key={h.id} className="mb-4 p-0 overflow-hidden" padded={false}>
            {h.image_url ? (
              <Image source={{ uri: h.image_url }} className="w-full h-36" />
            ) : null}
            <View className="p-4">
              <Text className={`${theme.text} text-lg font-bold`}>{h.name}</Text>
              {h.rating != null ? (
                <View className="flex-row items-center mt-2 gap-1">
                  <Star size={14} color="#F59E0B" fill="#F59E0B" />
                  <Text className={`${theme.textMuted} text-sm`}>{h.rating}</Text>
                </View>
              ) : null}
              <Text className={`${theme.textMuted} text-xs mt-2`}>OSM listing · estimated rate</Text>
              <Text className="text-sky-500 font-bold mt-1">
                {h.price_per_night_usd != null
                  ? `$${Number(h.price_per_night_usd).toFixed(0)}/night`
                  : 'Price on request'}
              </Text>
            </View>
          </Card>
        ))
      )}
    </View>
  )
}
