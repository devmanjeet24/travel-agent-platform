import { useRouter } from 'expo-router'
import { Map } from 'lucide-react-native'

import { TripCard } from '@/components/ui/TripCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import ScreenWrapper from '@/components/ui/ScreenWrapper'
import { mockTrips } from '@/constants/design'

export default function TripsScreen() {
  const router = useRouter()
  const hasTrips = mockTrips.length > 0

  return (
    <ScreenWrapper scroll>
      <ScreenHeader
        title="Saved trips"
        subtitle="Access offline · export PDF"
      />

      {hasTrips ? (
        mockTrips.map((trip) => (
          <TripCard
            key={trip.id}
            title={trip.title}
            subtitle={trip.subtitle}
            status={trip.status}
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
