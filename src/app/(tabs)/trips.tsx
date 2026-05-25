import { ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { Map } from 'lucide-react-native'

import { TripCard } from '@/components/ui/TripCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import ScreenWrapper from '@/components/ui/ScreenWrapper'
import { useTripsQuery } from '@/hooks/trips/use-trips-query'
import { useConfirmDeleteTrip } from '@/hooks/trips/use-confirm-delete-trip'
import { brand } from '@/constants/design'
import { tripCardLabels, tripImageUri } from '@/utils/trip-display'

export default function TripsScreen() {
  const router = useRouter()
  const { data: trips, isLoading } = useTripsQuery()
  const { confirmDelete } = useConfirmDeleteTrip()
  const hasTrips = (trips?.length ?? 0) > 0

  return (
    <ScreenWrapper scroll tabInset scrollFlexGrow>
      <ScreenHeader
        eyebrow="Your library"
        title="Saved trips"
        subtitle="Synced to your account · export PDF from trip overview"
      />

      {isLoading ? (
        <ActivityIndicator className="mt-12" color={brand.primaryDark} />
      ) : hasTrips ? (
        trips!.map((trip) => {
          const { displayTitle, subtitle } = tripCardLabels(trip)

          return (
            <TripCard
              key={trip.id}
              title={displayTitle}
              imageUri={tripImageUri(trip)}
              subtitle={subtitle}
              status={
                trip.status === 'completed'
                  ? 'completed'
                  : trip.status === 'upcoming'
                    ? 'upcoming'
                    : 'saved'
              }
              onPress={() => router.push(`/trip/${trip.id}`)}
              onDelete={() =>
                confirmDelete({ tripId: trip.id, tripTitle: displayTitle })
              }
            />
          )
        })
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
