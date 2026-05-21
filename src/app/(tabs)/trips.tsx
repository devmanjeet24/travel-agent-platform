import { ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { Map } from 'lucide-react-native'

import { TripCard } from '@/components/ui/TripCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import ScreenWrapper from '@/components/ui/ScreenWrapper'
import { useTripsQuery } from '@/hooks/trips/use-trips-query'
import { formatTripDates } from '@/services/trips/trip-api'

export default function TripsScreen() {
  const router = useRouter()
  const { data: trips, isLoading } = useTripsQuery()
  const hasTrips = (trips?.length ?? 0) > 0

  return (
    <ScreenWrapper scroll>
      <ScreenHeader
        title="Saved trips"
        subtitle="Synced to your account · export PDF from trip overview"
      />

      {isLoading ? (
        <ActivityIndicator className="mt-12" color="#0EA5E9" />
      ) : hasTrips ? (
        trips!.map((trip) => (
          <TripCard
            key={trip.id}
            title={trip.title}
            subtitle={`${formatTripDates(trip.start_date, trip.end_date)} · ${trip.status}`}
            status={
              trip.status === 'completed'
                ? 'completed'
                : trip.status === 'upcoming'
                  ? 'upcoming'
                  : 'saved'
            }
            onPress={() => router.push(`/trip/${trip.id}`)}
          />
        ))
      ) : (
        <EmptyState
          icon={Map}
          title="No saved trips yet"
          description="Chat with the AI or use the trip wizard to create your first itinerary."
          actionLabel="Start planning"
          onAction={() => router.push('/(tabs)/chat')}
        />
      )}
    </ScreenWrapper>
  )
}
