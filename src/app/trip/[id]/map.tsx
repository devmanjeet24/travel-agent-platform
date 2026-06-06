import { useEffect, useMemo, useRef, useState } from 'react'
import { View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'

import {
  AttractionRow,
  TripMap,
} from '@/components/maps/TripMap'
import { TripPlanPending } from '@/components/trip/TripPlanPending'
import TripScreenWrapper from '@/components/trip/TripScreenWrapper'
import { useTripItineraryQuery, useTripQuery } from '@/hooks/trips/use-trip-query'
import { useTripPlan } from '@/providers/trip-plan-provider'
import type { TripAttraction } from '@/constants/trip-attractions'
import { isValidCoordinate, sanitizeMapRegion } from '@/lib/map-coordinates'
import { itineraryToAttractions, regionFromAttractions } from '@/utils/itinerary-map'
import { geocodeTripItinerary } from '@/services/travel/travel-api'
import { tripKeys } from '@/services/trips/trip-keys'
import { brand } from '@/constants/design'
import { useThemedStyles } from '@/hooks/use-themed-styles'

const EMPTY_MAP_REGION = {
  latitude: 0,
  longitude: 0,
  latitudeDelta: 1,
  longitudeDelta: 1,
}

function mergeMapAttractions(
  destinationAttractions: TripAttraction[],
  itineraryAttractions: TripAttraction[],
) {
  const seen = new Set<string>()
  return [...destinationAttractions, ...itineraryAttractions].filter((attraction) => {
    const key = `${attraction.coordinate.latitude.toFixed(5)},${attraction.coordinate.longitude.toFixed(5)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function haversineKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const earthRadiusKm = 6371
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180
  const lat1 = (a.latitude * Math.PI) / 180
  const lat2 = (b.latitude * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

function maxMapDistanceKm(destination: string, country: string | null | undefined) {
  const normalizedDestination = destination.trim().toLowerCase()
  const normalizedCountry = country?.trim().toLowerCase()
  if (normalizedCountry && normalizedDestination === normalizedCountry) return 900
  if (!destination.includes(',')) return 500
  return 180
}

function normalizeRouteAttractions(
  attractions: TripAttraction[],
  destination: TripAttraction | undefined,
  maxDistanceKm: number,
) {
  if (!destination) return attractions

  return attractions
    .map((attraction) => {
      const coordinate = attraction.coordinate
      const swapped = {
        latitude: coordinate.longitude,
        longitude: coordinate.latitude,
      }
      const distance = haversineKm(destination.coordinate, coordinate)
      const swappedDistance = isValidCoordinate(swapped.latitude, swapped.longitude)
        ? haversineKm(destination.coordinate, swapped)
        : Number.POSITIVE_INFINITY

      if (distance > maxDistanceKm && swappedDistance <= maxDistanceKm) {
        return { ...attraction, coordinate: swapped }
      }
      return attraction
    })
    .filter(
      (attraction) =>
        haversineKm(destination.coordinate, attraction.coordinate) <= maxDistanceKm,
    )
}

export default function MapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const theme = useThemedStyles()
  const queryClient = useQueryClient()
  const geocodeAttempted = useRef(new Set<string>())
  const [focusedAttractionId, setFocusedAttractionId] = useState<string | null>(null)
  const { data: trip } = useTripQuery(id)
  const { data: itinerary, isLoading } = useTripItineraryQuery(id)
  const { needsPlan, isPlanning, queriesLoading, planError, retryPlan } = useTripPlan()

  const fromItinerary = useMemo(
    () => (itinerary ? itineraryToAttractions(itinerary) : []),
    [itinerary],
  )
  const destinationAttractions = useMemo(() => {
    if (
      trip?.destination_lat == null ||
      trip.destination_lon == null ||
      !isValidCoordinate(trip.destination_lat, trip.destination_lon)
    ) {
      return []
    }

    return [
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
  }, [trip])
  const maxDistanceKm = useMemo(
    () => maxMapDistanceKm(trip?.destination ?? '', trip?.country),
    [trip?.country, trip?.destination],
  )
  const routeAttractions = useMemo(
    () =>
      normalizeRouteAttractions(
        fromItinerary,
        destinationAttractions[0],
        maxDistanceKm,
      ),
    [destinationAttractions, fromItinerary, maxDistanceKm],
  )
  const attractions = useMemo(
    () => mergeMapAttractions(destinationAttractions, routeAttractions),
    [destinationAttractions, routeAttractions],
  )

  const needsItineraryGeocoding = useMemo(() => {
    if (!trip?.id || !itinerary?.length) return false
    const destination = destinationAttractions[0]
    const activityCount = itinerary.reduce((count, day) => count + day.activities.length, 0)
    if (activityCount < 2 || routeAttractions.length >= 2) return false

    return itinerary.some((day) =>
      day.activities.some((activity) => {
        const latitude = activity.latitude == null ? null : Number(activity.latitude)
        const longitude = activity.longitude == null ? null : Number(activity.longitude)
        if (!isValidCoordinate(latitude ?? NaN, longitude ?? NaN)) return true
        return destination
          ? haversineKm(destination.coordinate, { latitude: latitude!, longitude: longitude! }) >
              maxDistanceKm
          : false
      }),
    )
  }, [destinationAttractions, itinerary, maxDistanceKm, routeAttractions.length, trip?.id])

  useEffect(() => {
    if (!trip?.id || !needsItineraryGeocoding || geocodeAttempted.current.has(trip.id)) return
    geocodeAttempted.current.add(trip.id)

    void geocodeTripItinerary(trip.id)
      .then((result) => {
        if ((result.updated ?? 0) > 0) {
          void queryClient.invalidateQueries({ queryKey: tripKeys.itinerary(trip.id) })
          void queryClient.invalidateQueries({ queryKey: tripKeys.detail(trip.id) })
        }
      })
      .catch((error) => {
        console.warn('[MapScreen] itinerary geocode sync failed', {
          tripId: trip.id,
          error: error instanceof Error ? error.message : String(error),
        })
      })
  }, [needsItineraryGeocoding, queryClient, trip?.id])

  const region = useMemo(
    () =>
      sanitizeMapRegion(
        regionFromAttractions(attractions) ??
          (destinationAttractions[0]
            ? {
                latitude: destinationAttractions[0].coordinate.latitude,
                longitude: destinationAttractions[0].coordinate.longitude,
                latitudeDelta: 0.35,
                longitudeDelta: 0.35,
              }
            : EMPTY_MAP_REGION),
      ),
    [attractions, destinationAttractions],
  )

  if (isLoading || queriesLoading || (needsPlan && isPlanning)) {
    return <TripPlanPending />
  }

  if (needsPlan && planError) {
    return <TripPlanPending error={planError} onRetry={retryPlan} />
  }

  if (!attractions.length) {
    return (
      <TripPlanPending
        title="Preparing map…"
        subtitle="Geocoding your destination and itinerary activities."
        onRetry={retryPlan}
      />
    )
  }

  return (
    <TripScreenWrapper className={theme.bg}>
      <View className="h-[360px]">
        <TripMap
          attractions={attractions}
          routeAttractions={routeAttractions}
          initialRegion={region}
          focusedAttractionId={focusedAttractionId}
        />
      </View>

      {attractions.map((a) => (
        <AttractionRow
          key={a.id}
          attraction={a}
          onNavigate={() => setFocusedAttractionId(a.id)}
        />
      ))}
    </TripScreenWrapper>
  )
}
