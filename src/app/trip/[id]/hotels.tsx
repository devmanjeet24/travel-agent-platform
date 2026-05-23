import { useState } from 'react'
import { ActivityIndicator, Alert, Text } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'

import { TripHotelCard } from '@/components/trip/TripHotelCard'
import { Button } from '@/components/ui/Button'
import TripScreenWrapper from '@/components/trip/TripScreenWrapper'
import { useSyncTripTravel } from '@/hooks/trips/use-sync-trip-travel'
import { useTripHotelsQuery, useTripQuery } from '@/hooks/trips/use-trip-query'
import { tripKeys } from '@/services/trips/trip-keys'
import { searchAndCacheHotels } from '@/services/travel/travel-api'
import { brand } from '@/constants/design'
import { useThemedStyles } from '@/hooks/use-themed-styles'

export default function HotelsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const theme = useThemedStyles()
  const queryClient = useQueryClient()
  const { data: trip } = useTripQuery(id)
  const { data: hotels, isLoading, isFetching, isError } = useTripHotelsQuery(id)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  useSyncTripTravel(trip)

  const refresh = async () => {
    if (!trip?.start_date || !trip.end_date) {
      Alert.alert('Dates required', 'Add trip dates to search hotels.')
      return
    }
    setRefreshError(null)
    try {
      const result = await searchAndCacheHotels({
        tripId: trip.id,
        destination: trip.destination,
        startDate: trip.start_date,
        endDate: trip.end_date,
        budgetInr: trip.budget_usd ? Number(trip.budget_usd) : undefined,
        destinationLat: trip.destination_lat,
        destinationLon: trip.destination_lon,
      }) as { error?: string | null; hotels?: unknown[] }
      void queryClient.invalidateQueries({ queryKey: tripKeys.hotels(trip.id) })
      if (result.error && !result.hotels?.length) {
        setRefreshError(result.error)
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Search failed'
      setRefreshError(message)
      Alert.alert('Error', message)
    }
  }

  const loading = isLoading || (isFetching && !hotels?.length)

  return (
    <TripScreenWrapper className={theme.bg}>
      <Button title="Refresh hotels" variant="outline" onPress={refresh} />

      {refreshError ? (
        <Text className="text-red-500 text-sm mt-4 text-center">{refreshError}</Text>
      ) : null}

      {loading ? (
        <ActivityIndicator className="mt-8" color={brand.primaryDark} />
      ) : isError ? (
        <Text className={`${theme.textMuted} mt-6 text-center`}>
          Could not load hotels. Check your connection and try refresh.
        </Text>
      ) : !hotels?.length ? (
        <Text className={`${theme.textMuted} mt-6 text-center`}>
          No hotels found for this destination yet. Add trip dates and tap refresh — we load real
          listings from OpenStreetMap.
        </Text>
      ) : (
        hotels.map((h) => <TripHotelCard key={h.id} hotel={h} />)
      )}
    </TripScreenWrapper>
  )
}
