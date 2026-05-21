import { useQuery } from '@tanstack/react-query';

import { tripKeys } from '@/services/trips/trip-keys';
import {
  fetchBudgetCategories,
  fetchItinerary,
  fetchPackingItems,
  fetchTripById,
  fetchTripFlights,
  fetchTripHotels,
} from '@/services/trips/trip-api';

export function useTripQuery(id: string | undefined) {
  return useQuery({
    queryKey: tripKeys.detail(id ?? ''),
    queryFn: () => fetchTripById(id!),
    enabled: Boolean(id),
  });
}

export function useTripItineraryQuery(tripId: string | undefined) {
  return useQuery({
    queryKey: tripKeys.itinerary(tripId ?? ''),
    queryFn: () => fetchItinerary(tripId!),
    enabled: Boolean(tripId),
  });
}

export function useTripBudgetQuery(tripId: string | undefined) {
  return useQuery({
    queryKey: tripKeys.budget(tripId ?? ''),
    queryFn: () => fetchBudgetCategories(tripId!),
    enabled: Boolean(tripId),
  });
}

export function useTripHotelsQuery(tripId: string | undefined) {
  return useQuery({
    queryKey: tripKeys.hotels(tripId ?? ''),
    queryFn: () => fetchTripHotels(tripId!),
    enabled: Boolean(tripId),
  });
}

export function useTripFlightsQuery(tripId: string | undefined) {
  return useQuery({
    queryKey: tripKeys.flights(tripId ?? ''),
    queryFn: () => fetchTripFlights(tripId!),
    enabled: Boolean(tripId),
  });
}

export function useTripPackingQuery(tripId: string | undefined) {
  return useQuery({
    queryKey: tripKeys.packing(tripId ?? ''),
    queryFn: () => fetchPackingItems(tripId!),
    enabled: Boolean(tripId),
  });
}
