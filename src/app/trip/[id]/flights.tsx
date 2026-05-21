import { ActivityIndicator, Alert, Text, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { Plane } from 'lucide-react-native'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useTripFlightsQuery, useTripQuery } from '@/hooks/trips/use-trip-query'
import { tripKeys } from '@/services/trips/trip-keys'
import { searchAndCacheFlights } from '@/services/travel/travel-api'
import { useThemedStyles } from '@/hooks/use-themed-styles'

export default function FlightsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const theme = useThemedStyles()
  const queryClient = useQueryClient()
  const { data: trip } = useTripQuery(id)
  const { data: flights, isLoading } = useTripFlightsQuery(id)

  const refresh = async () => {
    if (!trip?.start_date) {
      Alert.alert('Date required', 'Add a start date to search flights.')
      return
    }
    if (!trip.origin_city) {
      Alert.alert('Origin required', 'Set origin city in trip wizard (e.g. Delhi).')
      return
    }
    try {
      await searchAndCacheFlights({
        tripId: trip.id,
        origin: trip.origin_city,
        destination: trip.destination,
        departDate: trip.start_date,
        budgetUsd: trip.budget_usd ? Number(trip.budget_usd) : undefined,
      })
      void queryClient.invalidateQueries({ queryKey: tripKeys.flights(trip.id) })
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Search failed')
    }
  }

  return (
    <View className={`flex-1 ${theme.bg} px-5 pb-8`}>
      <Button title="Refresh flight estimates" variant="outline" onPress={refresh} />

      {isLoading ? (
        <ActivityIndicator className="mt-8" color="#0EA5E9" />
      ) : !flights?.length ? (
        <Text className={`${theme.textMuted} mt-6 text-center`}>
          No flights cached. Set origin city + start date, then refresh for OSM-based estimates.
        </Text>
      ) : (
        flights.map((f) => (
          <Card key={f.id} className="mb-4">
            <View className="flex-row items-center gap-2 mb-3">
              <Plane size={20} color="#0EA5E9" />
              <Text className={`${theme.text} font-bold`}>{f.airline ?? 'Airline'}</Text>
            </View>
            <Text className={`${theme.text} text-lg font-semibold`}>{f.route}</Text>
            <Text className={`${theme.textMuted} mt-2`}>
              {f.depart_time} → {f.arrive_time} · {f.stops}
            </Text>
            <Text className={`${theme.textMuted} text-xs mt-1`}>Estimated fare (not a live booking)</Text>
            <Text className="text-sky-500 font-bold text-xl mt-1">
              {f.price_usd != null ? `$${Number(f.price_usd).toFixed(0)}` : '—'}
            </Text>
          </Card>
        ))
      )}
    </View>
  )
}
