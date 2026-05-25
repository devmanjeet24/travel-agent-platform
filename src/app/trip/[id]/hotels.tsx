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
  const { hotelsSyncing, hotelsSyncError } = useSyncTripTravel(trip)

  const refresh = async () => {
    if (!trip) {
      return
    }
    setRefreshError(null)
    try {
      const result = await searchAndCacheHotels({
        tripId: trip.id,
        destination: trip.destination,
        startDate: trip.start_date ?? undefined,
        endDate: trip.end_date ?? undefined,
        budgetInr: trip.budget_usd ? Number(trip.budget_usd) : undefined,
        destinationLat: trip.destination_lat,
        destinationLon: trip.destination_lon,
      })
      await queryClient.invalidateQueries({ queryKey: tripKeys.hotels(trip.id) })
      void queryClient.invalidateQueries({ queryKey: tripKeys.detail(trip.id) })
      void queryClient.invalidateQueries({ queryKey: tripKeys.all })
      if (result.error && !result.hotels?.length) {
        setRefreshError(result.error)
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Search failed'
      setRefreshError(message)
      Alert.alert('Error', message)
    }
  }

  const syncError = refreshError ?? hotelsSyncError
  const loading = isLoading || hotelsSyncing || (isFetching && !hotels?.length)

  return (
    <TripScreenWrapper className={theme.bg}>
      <Button
        title={hotelsSyncing ? 'Searching OpenStreetMap hotels…' : 'Refresh hotels'}
        variant="outline"
        onPress={refresh}
        disabled={hotelsSyncing}
      />

      {syncError ? (
        <Text className="text-red-500 text-sm mt-4 text-center">{syncError}</Text>
      ) : null}

      {loading ? (
        <ActivityIndicator className="mt-8" color={brand.primaryDark} />
      ) : isError ? (
        <Text className={`${theme.textMuted} mt-6 text-center`}>
          Could not load hotels. Check your connection and try refresh.
        </Text>
      ) : !hotels?.length ? (
        <Text className={`${theme.textMuted} mt-6 text-center`}>
          No OpenStreetMap hotels found for this destination yet. Tap refresh to search again.
        </Text>
      ) : (
        hotels.map((h) => <TripHotelCard key={h.id} hotel={h} />)
      )}
    </TripScreenWrapper>
  )
}
