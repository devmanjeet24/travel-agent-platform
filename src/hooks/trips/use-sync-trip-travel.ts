import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { useRoutePolicy } from '@/hooks/trips/use-route-policy'
import { tripKeys } from '@/services/trips/trip-keys'
import {
  searchAndCacheFlights,
  searchAndCacheHotels,
  syncTripDestination,
} from '@/services/travel/travel-api'
import type { TripRow } from '@/types/database'
import { useTripFlightsQuery, useTripHotelsQuery } from '@/hooks/trips/use-trip-query'
import {
  hasLowQualityHotelData,
  hasOnlyStaleFlights,
  hasOnlyStaleHotels,
} from '@/utils/travel-data-validity'

/** Load travel data when a trip module opens and cached data is missing or low quality. */
export function useSyncTripTravel(trip: TripRow | null | undefined) {
  const queryClient = useQueryClient()
  const tripId = trip?.id
  const { data: hotels, isLoading: hotelsLoading } = useTripHotelsQuery(tripId)
  const { data: flights, isLoading: flightsLoading } = useTripFlightsQuery(tripId)
  const { data: routePolicy } = useRoutePolicy(trip)
  const geocodeAttempted = useRef(false)
  const hotelsAttempted = useRef(false)
  const flightsAttempted = useRef(false)
  const [hotelsSyncing, setHotelsSyncing] = useState(false)
  const [hotelsSyncError, setHotelsSyncError] = useState<string | null>(null)

  const includeFlights = routePolicy?.includeFlights ?? true

  useEffect(() => {
    geocodeAttempted.current = false
    hotelsAttempted.current = false
    flightsAttempted.current = false
  }, [
    tripId,
    trip?.destination,
    trip?.destination_lat,
    trip?.destination_lon,
    trip?.origin_city,
    trip?.start_date,
    trip?.end_date,
    trip?.budget_usd,
    trip?.travelers,
  ])

  useEffect(() => {
    if (!trip?.id || !trip.destination?.trim()) return
    const missingCoords =
      trip.destination_lat == null ||
      trip.destination_lon == null ||
      !Number.isFinite(trip.destination_lat) ||
      !Number.isFinite(trip.destination_lon)
    if (!missingCoords || geocodeAttempted.current) return
    geocodeAttempted.current = true

    void syncTripDestination({ tripId: trip.id, destination: trip.destination })
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: tripKeys.detail(trip.id) })
      })
      .catch(() => {
        geocodeAttempted.current = false
      })
  }, [trip?.id, trip?.destination, trip?.destination_lat, trip?.destination_lon, queryClient])

  useEffect(() => {
    if (!trip?.id) return
    const needsHotels =
      !hotels?.length || hasOnlyStaleHotels(hotels) || hasLowQualityHotelData(hotels)
    if (hotelsLoading || !needsHotels || hotelsAttempted.current) return
    hotelsAttempted.current = true
    setHotelsSyncing(true)
    setHotelsSyncError(null)

    void searchAndCacheHotels({
      tripId: trip.id,
      destination: trip.destination,
      startDate: trip.start_date ?? undefined,
      endDate: trip.end_date ?? undefined,
      budgetInr: trip.budget_usd ? Number(trip.budget_usd) : undefined,
      travelers: trip.travelers,
      destinationLat: trip.destination_lat,
      destinationLon: trip.destination_lon,
    })
      .then((result) => {
        if (result.error && !result.hotels?.length) {
          setHotelsSyncError(result.error)
        }
        void queryClient.invalidateQueries({ queryKey: tripKeys.hotels(trip.id) })
        void queryClient.invalidateQueries({ queryKey: tripKeys.detail(trip.id) })
        void queryClient.invalidateQueries({ queryKey: tripKeys.all })
      })
      .catch((error) => {
        setHotelsSyncError(error instanceof Error ? error.message : 'Hotel search failed')
        hotelsAttempted.current = false
      })
      .finally(() => {
        setHotelsSyncing(false)
      })
  }, [
    trip?.id,
    trip?.destination,
    trip?.start_date,
    trip?.end_date,
    trip?.budget_usd,
    trip?.travelers,
    trip?.destination_lat,
    trip?.destination_lon,
    hotelsLoading,
    hotels?.length,
    hotels,
    queryClient,
  ])

  useEffect(() => {
    if (!trip?.id || !trip.start_date || !trip.origin_city) return
    if (routePolicy && !includeFlights) {
      if (!flights?.length || flightsAttempted.current) return
      flightsAttempted.current = true

      void searchAndCacheFlights({
        tripId: trip.id,
        origin: trip.origin_city,
        destination: trip.destination,
        departDate: trip.start_date,
        startDate: trip.start_date,
        endDate: trip.end_date ?? undefined,
        budgetInr: trip.budget_usd ? Number(trip.budget_usd) : undefined,
        travelers: trip.travelers,
      })
        .then(() => {
          void queryClient.invalidateQueries({ queryKey: tripKeys.flights(trip.id) })
        })
        .catch(() => {
          flightsAttempted.current = false
        })
      return
    }

    const needsFlights = !flights?.length || hasOnlyStaleFlights(flights)
    if (flightsLoading || !needsFlights || flightsAttempted.current) return
    flightsAttempted.current = true

    void searchAndCacheFlights({
      tripId: trip.id,
      origin: trip.origin_city,
      destination: trip.destination,
      departDate: trip.start_date,
      startDate: trip.start_date,
      endDate: trip.end_date ?? undefined,
      budgetInr: trip.budget_usd ? Number(trip.budget_usd) : undefined,
      travelers: trip.travelers,
    })
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: tripKeys.flights(trip.id) })
      })
      .catch(() => {
        flightsAttempted.current = false
      })
  }, [
    trip?.id,
    trip?.destination,
    trip?.origin_city,
    trip?.start_date,
    trip?.end_date,
    trip?.budget_usd,
    trip?.travelers,
    flightsLoading,
    flights?.length,
    flights,
    includeFlights,
    routePolicy,
    queryClient,
  ])

  return { hotelsSyncing, hotelsSyncError }
}
