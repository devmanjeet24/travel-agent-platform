import { ActivityIndicator, Alert, Text, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { Plane } from 'lucide-react-native'

import { TransportBadge } from '@/components/trip/TransportBadge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import TripScreenWrapper from '@/components/trip/TripScreenWrapper'
import { useRoutePolicy } from '@/hooks/trips/use-route-policy'
import { useSyncTripTravel } from '@/hooks/trips/use-sync-trip-travel'
import {
  useTripFlightsQuery,
  useTripItineraryQuery,
  useTripQuery,
} from '@/hooks/trips/use-trip-query'
import { tripKeys } from '@/services/trips/trip-keys'
import { searchAndCacheFlights } from '@/services/travel/travel-api'
import { brand } from '@/constants/design'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import {
  flightDurationLabel,
  flightNote,
  flightPriceLabel,
  parseFlightRaw,
} from '@/utils/flight-display'
import {
  collectItineraryTransportOptions,
  isLowTripBudget,
  tripDaysBetween,
} from '@/utils/transport-display'

function flightAirportLine(raw: unknown): string | null {
  const r = parseFlightRaw(raw)
  if (r?.originAirport && r?.destAirport) {
    const codes =
      r.originAirportCode && r.destAirportCode
        ? ` (${r.originAirportCode} → ${r.destAirportCode})`
        : ''
    return `${r.originAirport} → ${r.destAirport}${codes}`
  }
  return null
}

export default function FlightsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const theme = useThemedStyles()
  const queryClient = useQueryClient()
  const { data: trip } = useTripQuery(id)
  const { data: itinerary } = useTripItineraryQuery(id)
  const { data: flights, isLoading, isFetching, isError } = useTripFlightsQuery(id)
  const { data: routePolicy } = useRoutePolicy(trip)
  useSyncTripTravel(trip)

  const groundOptions = collectItineraryTransportOptions(itinerary)
  const preferGround = routePolicy?.preferGround ?? groundOptions.some((o) => o.kind !== 'flight')
  const lowBudget = isLowTripBudget(
    trip?.budget_usd ? Number(trip.budget_usd) : undefined,
    trip?.travelers ?? 1,
    tripDaysBetween(trip?.start_date ?? null, trip?.end_date ?? null),
  )

  const refresh = async () => {
    if (!trip?.start_date) {
      Alert.alert('Date required', 'Add a start date to search flights.')
      return
    }
    if (!trip.origin_city) {
      Alert.alert('Origin required', 'Set origin city in trip wizard (e.g. Delhi).')
      return
    }
    if (routePolicy && !routePolicy.includeFlights) {
      Alert.alert(
        'Ground transport recommended',
        'For this route and budget, train, bus, or ferry options from your itinerary are a better fit than flights.',
      )
      return
    }
    try {
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
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Search failed')
    }
  }

  const loading =
    isLoading || (isFetching && !flights?.length && !groundOptions.length)
  const showGroundSection = groundOptions.length > 0
  const showFlightsSection = Boolean(flights?.length)
  const hasTransportContent = showGroundSection || showFlightsSection

  return (
    <TripScreenWrapper className={theme.bg}>
      <Button
        title={preferGround ? 'Refresh flight options (if needed)' : 'Refresh flight options'}
        variant="outline"
        onPress={refresh}
      />

      {loading ? (
        <ActivityIndicator className="mt-8" color={brand.primaryDark} />
      ) : isError && !hasTransportContent ? (
        <Text className={`${theme.textMuted} mt-6 text-center`}>
          Could not load transport options. Check your connection and try refresh.
        </Text>
      ) : (
        <>
          {showGroundSection ? (
            <>
              <Text className={`${theme.textMuted} mt-4 mb-2 text-sm leading-5`}>
                {preferGround
                  ? 'Train, bus, metro, ferry, and local transport from your AI itinerary — recommended for this route and budget.'
                  : 'Transport options from your itinerary.'}
              </Text>
              {groundOptions.map((option, index) => (
                <Card key={`${option.kind}-${option.detail}-${index}`} className="mb-4">
                  <Text className={`${theme.text} font-semibold text-base`}>
                    {option.activityName}
                  </Text>
                  <TransportBadge
                    icon={option.icon}
                    label={option.label}
                    detail={option.detail}
                    budgetFriendly={option.budgetFriendly}
                    showBudgetHint={lowBudget}
                  />
                </Card>
              ))}
            </>
          ) : null}

          {showFlightsSection ? (
            <>
              {showGroundSection ? (
                <Text className={`${theme.text} font-bold text-base mt-4 mb-2`}>
                  Flight options
                </Text>
              ) : null}
              {flights!.map((f) => {
                const airports = flightAirportLine(f.raw)
                const duration = flightDurationLabel(f.raw)
                const note = flightNote(f.raw)
                return (
                  <Card key={f.id} className="mb-4 mt-2">
                    <View className="flex-row items-center gap-2 mb-3">
                      <Plane size={20} color={brand.primaryDark} />
                      <Text className={`${theme.text} font-bold`}>
                        {f.airline ?? 'Flight option'}
                      </Text>
                    </View>
                    <Text className={`${theme.text} text-lg font-semibold`}>{f.route}</Text>
                    {airports ? (
                      <Text className={`${theme.textMuted} text-sm mt-1`}>{airports}</Text>
                    ) : null}
                    <Text className={`${theme.textMuted} mt-2`}>
                      {f.depart_time} → {f.arrive_time}
                      {duration ? ` · ${duration}` : ''} · {f.stops}
                    </Text>
                    <Text className={`${theme.textMuted} text-xs mt-1`}>
                      {note ?? 'Flight availability and prices can change before booking.'}
                    </Text>
                    <Text className="text-yellow-600 font-bold text-xl mt-1">
                      {flightPriceLabel(f.raw, f.price_usd)}
                    </Text>
                  </Card>
                )
              })}
            </>
          ) : !showGroundSection ? (
            <Text className={`${theme.textMuted} mt-6 text-center`}>
              {routePolicy && !routePolicy.includeFlights
                ? 'Flights are not recommended for this route. Regenerate your AI plan with an origin city to see train, bus, and local transport in your itinerary.'
                : 'No transport cached yet. Set origin city and start date, then refresh — or regenerate your AI plan for train and bus legs.'}
            </Text>
          ) : null}
        </>
      )}
    </TripScreenWrapper>
  )
}
