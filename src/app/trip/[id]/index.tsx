import { useState } from 'react'
import { ActivityIndicator, Alert, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  FileDown,
  Map,
  Plane,
  Wallet,
  Hotel,
  ListChecks,
  Calendar,
} from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'
import { useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useTripBudgetQuery, useTripItineraryQuery, useTripQuery } from '@/hooks/trips/use-trip-query'
import { usePlanTripMutation } from '@/hooks/trips/use-plan-trip-mutation'
import { tripKeys } from '@/services/trips/trip-keys'
import { formatTripDates } from '@/services/trips/trip-api'
import { searchAndCacheHotels } from '@/services/travel/travel-api'
import { exportTripPdf } from '@/lib/pdf-export'
import { brand } from '@/constants/design'
import { useThemedStyles } from '@/hooks/use-themed-styles'

const sections: { label: string; route: string; icon: LucideIcon }[] = [
  { label: 'Itinerary', route: 'itinerary', icon: Calendar },
  { label: 'Budget', route: 'budget', icon: Wallet },
  { label: 'Flights', route: 'flights', icon: Plane },
  { label: 'Hotels', route: 'hotels', icon: Hotel },
  { label: 'Map & routes', route: 'map', icon: Map },
  { label: 'Packing list', route: 'packing', icon: ListChecks },
]

export default function TripOverviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const theme = useThemedStyles()
  const queryClient = useQueryClient()
  const { data: trip, isLoading } = useTripQuery(id)
  const { data: itinerary } = useTripItineraryQuery(id)
  const { data: budget } = useTripBudgetQuery(id)
  const planTrip = usePlanTripMutation()
  const [refreshing, setRefreshing] = useState(false)

  const handleRefreshTravel = async () => {
    if (!trip?.start_date || !trip.end_date) {
      Alert.alert('Add dates', 'Set start and end dates on this trip to search hotels.')
      return
    }
    setRefreshing(true)
    try {
      await searchAndCacheHotels({
        tripId: trip.id,
        destination: trip.destination,
        startDate: trip.start_date,
        endDate: trip.end_date,
      })
      void queryClient.invalidateQueries({ queryKey: tripKeys.hotels(trip.id) })
      Alert.alert('Hotels updated', 'OpenStreetMap hotels saved to this trip.')
    } catch (e) {
      Alert.alert('Search failed', e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setRefreshing(false)
    }
  }

  const handleExportPdf = async () => {
    if (!trip) return
    try {
      await exportTripPdf({
        trip,
        itinerary: itinerary ?? [],
        budget: budget ?? [],
      })
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : 'Unknown error')
    }
  }

  if (isLoading || !trip) {
    return (
      <View className={`flex-1 ${theme.bg} items-center justify-center`}>
        <ActivityIndicator color={brand.primaryDark} />
      </View>
    )
  }

  return (
    <View className={`flex-1 ${theme.bg} px-5 pb-8`}>
      <Card className="mt-2">
        <Text className={`${theme.text} text-2xl font-bold`}>{trip.title}</Text>
        <Text className={`${theme.textMuted} mt-1`}>
          {formatTripDates(trip.start_date, trip.end_date)} · {trip.travelers} travelers
        </Text>
        <Text className="text-yellow-600 font-medium mt-3 capitalize">{trip.status}</Text>
      </Card>

      <Button
        title={planTrip.isPending ? 'Planning…' : 'Regenerate AI plan'}
        variant="secondary"
        className="mt-4"
        onPress={() => planTrip.mutate(trip.id)}
        disabled={planTrip.isPending}
      />

      <Button
        title={refreshing ? 'Searching hotels…' : 'Refresh live hotels'}
        variant="outline"
        className="mt-3"
        onPress={handleRefreshTravel}
        disabled={refreshing}
      />

      <Text className={`${theme.text} font-bold text-lg mt-6 mb-3`}>Trip modules</Text>
      {sections.map((s) => {
        const Icon = s.icon
        return (
          <Card
            key={s.route}
            onPress={() => router.push(`/trip/${id}/${s.route}` as never)}
            className="mb-3 flex-row items-center"
          >
            <View className="bg-yellow-500/20 p-3 rounded-xl mr-4">
              <Icon size={22} color={brand.primaryDark} />
            </View>
            <Text className={`${theme.text} font-semibold text-base flex-1`}>
              {s.label}
            </Text>
          </Card>
        )
      })}

      <Button
        title="Open AI chat for this trip"
        className="mt-4 flex-row gap-2"
        onPress={() =>
          router.push(`/(tabs)/chat?tripId=${trip.id}` as never)
        }
      />

      <Button
        title="Export PDF"
        variant="secondary"
        className="mt-3 flex-row gap-2"
        onPress={handleExportPdf}
      />
      <View className="flex-row items-center justify-center mt-3 gap-2">
        <FileDown size={18} color={brand.primaryDark} />
        <Text className={`${theme.textMuted} text-sm`}>Share itinerary & budget</Text>
      </View>
    </View>
  )
}
