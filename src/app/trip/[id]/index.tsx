import { useState } from 'react'
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  FileDown,
  Map,
  Navigation,
  Wallet,
  Hotel,
  ListChecks,
  Calendar,
  ChevronRight,
} from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'
import { useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { TransportBadge } from '@/components/trip/TransportBadge'
import { TripHotelCard } from '@/components/trip/TripHotelCard'
import TripScreenWrapper from '@/components/trip/TripScreenWrapper'
import { useRoutePolicy } from '@/hooks/trips/use-route-policy'
import { useSyncTripTravel } from '@/hooks/trips/use-sync-trip-travel'
import {
  useTripBudgetQuery,
  useTripFlightsQuery,
  useTripHotelsQuery,
  useTripItineraryQuery,
  useTripQuery,
} from '@/hooks/trips/use-trip-query'
import { usePlanTripMutation } from '@/hooks/trips/use-plan-trip-mutation'
import { useConfirmDeleteTrip } from '@/hooks/trips/use-confirm-delete-trip'
import { tripKeys } from '@/services/trips/trip-keys'
import { formatTripDates } from '@/services/trips/trip-api'
import { searchAndCacheFlights, searchAndCacheHotels, fetchRoutePolicy } from '@/services/travel/travel-api'
import { exportTripPdf } from '@/lib/pdf-export'
import { brand } from '@/constants/design'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import {
  collectItineraryTransportOptions,
  isLowTripBudget,
  tripDaysBetween,
} from '@/utils/transport-display'

const sections: { label: string; route: string; icon: LucideIcon }[] = [
  { label: 'Itinerary', route: 'itinerary', icon: Calendar },
  { label: 'Budget', route: 'budget', icon: Wallet },
  { label: 'Transport', route: 'flights', icon: Navigation },
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
  const { data: hotels, isLoading: hotelsLoading } = useTripHotelsQuery(id)
  const { data: flights } = useTripFlightsQuery(id)
  const { data: routePolicy } = useRoutePolicy(trip)
  const planTrip = usePlanTripMutation()
  const { confirmDelete, isDeleting } = useConfirmDeleteTrip()
  const [refreshing, setRefreshing] = useState(false)

  useSyncTripTravel(trip)

  const groundPreview = collectItineraryTransportOptions(itinerary).slice(0, 3)
  const hotelPreview = hotels?.slice(0, 2) ?? []
  const preferGround = routePolicy?.preferGround ?? groundPreview.length > 0
  const lowBudget = isLowTripBudget(
    trip?.budget_usd ? Number(trip.budget_usd) : undefined,
    trip?.travelers ?? 1,
    tripDaysBetween(trip?.start_date ?? null, trip?.end_date ?? null),
  )

  const handleRefreshTravel = async () => {
    if (!trip) {
      return
    }
    setRefreshing(true)
    try {
      await searchAndCacheHotels({
        tripId: trip.id,
        destination: trip.destination,
        startDate: trip.start_date ?? undefined,
        endDate: trip.end_date ?? undefined,
        budgetInr: trip.budget_usd ? Number(trip.budget_usd) : undefined,
        travelers: trip.travelers,
        destinationLat: trip.destination_lat,
        destinationLon: trip.destination_lon,
      })
      if (trip.origin_city && trip.start_date) {
        const policy = await fetchRoutePolicy({
          origin: trip.origin_city,
          destination: trip.destination,
          startDate: trip.start_date ?? undefined,
          endDate: trip.end_date ?? undefined,
          budgetInr: trip.budget_usd ? Number(trip.budget_usd) : undefined,
          travelers: trip.travelers,
        })
        if (policy) {
          await searchAndCacheFlights({
            tripId: trip.id,
            origin: trip.origin_city,
            destination: trip.destination,
            departDate: trip.start_date,
            startDate: trip.start_date,
            endDate: trip.end_date ?? undefined,
            budgetInr: trip.budget_usd ? Number(trip.budget_usd) : undefined,
            travelers: trip.travelers,
          })
          void queryClient.invalidateQueries({ queryKey: tripKeys.flights(trip.id) })
        }
      }
      void queryClient.invalidateQueries({ queryKey: tripKeys.hotels(trip.id) })
      void queryClient.invalidateQueries({ queryKey: tripKeys.detail(trip.id) })
      void queryClient.invalidateQueries({ queryKey: tripKeys.all })
      void queryClient.invalidateQueries({ queryKey: tripKeys.itinerary(trip.id) })
      Alert.alert(
        'Travel data updated',
        trip.origin_city
          ? 'Real hotel listings saved. Flights refreshed only when recommended for this route.'
          : 'Real hotel listings saved to this trip.',
      )
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
      <TripScreenWrapper scroll={false} centered>
        <ActivityIndicator color={brand.primaryDark} />
      </TripScreenWrapper>
    )
  }

  const transportHint =
    preferGround && !routePolicy?.includeFlights
      ? 'Train, bus & local · from itinerary'
      : preferGround
        ? 'Train, bus & flights'
        : flights?.length
          ? `${flights.length} flight option${flights.length === 1 ? '' : 's'}`
          : groundPreview.length
            ? 'From itinerary'
            : 'Set origin city to load options'

  const hotelsHint = hotelPreview.length
    ? `${hotels?.length ?? hotelPreview.length} real hotel listings`
    : hotelsLoading
      ? 'Loading hotels…'
      : 'Tap refresh for OpenStreetMap hotels'

  return (
    <TripScreenWrapper>
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
        title={refreshing ? 'Refreshing travel data…' : 'Refresh hotels & transport'}
        variant="outline"
        className="mt-3"
        onPress={handleRefreshTravel}
        disabled={refreshing}
      />

      <View className="mt-6">
        <View className="mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className={`${theme.text} font-bold text-lg`}>Transport</Text>
            {(groundPreview.length > 0 || flights?.length) && (
              <Pressable
                onPress={() => router.push(`/trip/${id}/flights` as never)}
                className="flex-row items-center gap-1"
              >
                <Text className="text-yellow-600 text-sm font-semibold">See all</Text>
                <ChevronRight size={16} color={brand.primaryDark} />
              </Pressable>
            )}
          </View>
          {groundPreview.length > 0 ? (
            groundPreview.map((option, index) => (
              <Card key={`${option.kind}-${index}`} className="mb-3">
                <Text className={`${theme.text} font-semibold text-sm`}>{option.activityName}</Text>
                <TransportBadge
                  icon={option.icon}
                  label={option.label}
                  detail={option.detail}
                  budgetFriendly={option.budgetFriendly}
                  showBudgetHint={lowBudget}
                />
              </Card>
            ))
          ) : (
            <Text className={`${theme.textMuted} text-sm`}>
              {trip.origin_city
                ? preferGround
                  ? 'Regenerate your AI plan to add train, bus, and local legs — or open Transport for flight options when recommended.'
                  : 'Open Transport for flight options, or regenerate your plan for itinerary legs.'
                : 'Add an origin city (e.g. Delhi) when creating the trip, then regenerate the plan for train and bus options.'}
            </Text>
          )}
        </View>

        <View>
          <View className="flex-row items-center justify-between mb-3">
            <Text className={`${theme.text} font-bold text-lg`}>Hotels</Text>
            {hotelPreview.length > 0 ? (
              <Pressable
                onPress={() => router.push(`/trip/${id}/hotels` as never)}
                className="flex-row items-center gap-1"
              >
                <Text className="text-yellow-600 text-sm font-semibold">See all</Text>
                <ChevronRight size={16} color={brand.primaryDark} />
              </Pressable>
            ) : null}
          </View>
          {hotelsLoading && !hotelPreview.length ? (
            <ActivityIndicator color={brand.primaryDark} />
          ) : hotelPreview.length > 0 ? (
            hotelPreview.map((h) => <TripHotelCard key={h.id} hotel={h} compact />)
          ) : (
            <Text className={`${theme.textMuted} text-sm`}>
              {trip.start_date && trip.end_date
                ? 'No hotels loaded yet. Tap “Refresh hotels & transport” — we pull real property names, addresses, and photos from configured providers.'
                : 'Add trip start and end dates, then refresh to load real hotel listings.'}
            </Text>
          )}
        </View>
      </View>

      <Text className={`${theme.text} font-bold text-lg mt-6 mb-3`}>Trip modules</Text>
      {sections.map((s) => {
        const Icon = s.icon
        const subtitle =
          s.route === 'flights'
            ? transportHint
            : s.route === 'hotels'
              ? hotelsHint
              : null
        return (
          <Card
            key={s.route}
            onPress={() => router.push(`/trip/${id}/${s.route}` as never)}
            className="mb-3 flex-row items-center"
          >
            <View className="bg-yellow-500/20 p-3 rounded-xl mr-4">
              <Icon size={22} color={brand.primaryDark} />
            </View>
            <View className="flex-1">
              <Text className={`${theme.text} font-semibold text-base`}>{s.label}</Text>
              {subtitle ? (
                <Text className={`${theme.textMuted} text-xs mt-0.5`}>{subtitle}</Text>
              ) : null}
            </View>
            <ChevronRight size={20} color="#94A3B8" />
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

      <Button
        title={isDeleting ? 'Deleting…' : 'Delete trip'}
        variant="danger"
        className="mt-8 mb-2"
        onPress={() =>
          confirmDelete({
            tripId: trip.id,
            tripTitle: trip.title,
            onDeleted: () => router.replace('/(tabs)/trips' as never),
          })
        }
        disabled={isDeleting}
      />
    </TripScreenWrapper>
  )
}
