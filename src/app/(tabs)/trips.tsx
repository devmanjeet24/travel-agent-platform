import { useMemo, useState } from 'react'
import { View } from 'react-native'
import { useRouter } from 'expo-router'
import { Map, Plus } from 'lucide-react-native'

import { ItineraryCard } from '@/components/ui/ItineraryCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { SegmentTabs } from '@/components/ui/SegmentTabs'
import ScreenWrapper from '@/components/ui/ScreenWrapper'
import { CardSkeleton } from '@/components/ui/LoadingSkeleton'
import { brand, spacing } from '@/constants/design'
import { useTripsQuery } from '@/hooks/trips/use-trips-query'
import { useConfirmDeleteTrip } from '@/hooks/trips/use-confirm-delete-trip'
import { tripCardLabels, tripImageUri } from '@/utils/trip-display'
import { formatTripDates } from '@/services/trips/trip-api'
import { useSyncTripDestinations } from '@/hooks/trips/use-sync-trip-destinations'
import { Pressable } from 'react-native'
import { radii } from '@/lib/ui-styles'
import type { TripRow } from '@/types/database'

type TripFilter = 'all' | 'upcoming' | 'completed'

function filterTrips(trips: TripRow[], filter: TripFilter) {
  if (filter === 'all') return trips
  if (filter === 'upcoming') {
    return trips.filter((t) => t.status === 'upcoming' || t.status === 'saved')
  }
  return trips.filter((t) => t.status === 'completed')
}

function tripCardStatus(status: TripRow['status']): 'upcoming' | 'saved' | 'completed' {
  if (status === 'upcoming') return 'upcoming'
  if (status === 'completed') return 'completed'
  return 'saved'
}

export default function TripsScreen() {
  const router = useRouter()
  const { data: trips, isLoading } = useTripsQuery()
  const { confirmDelete } = useConfirmDeleteTrip()
  const [filter, setFilter] = useState<TripFilter>('all')

  useSyncTripDestinations(trips)

  const filtered = useMemo(() => filterTrips(trips ?? [], filter), [trips, filter])
  const hasTrips = (trips?.length ?? 0) > 0

  return (
    <ScreenWrapper scroll tabInset scrollFlexGrow={false} subtleBackground>
      <PageHeader
        large
        title="Itinerary"
        subtitle="Your planned adventures — synced across devices"
        rightElement={
          <Pressable
            onPress={() => router.push('/trip/wizard')}
            accessibilityLabel="Plan new trip"
            style={{
              width: 44,
              height: 44,
              borderRadius: radii.pill,
              backgroundColor: brand.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Plus size={22} color={brand.onPrimary} strokeWidth={2.5} />
          </Pressable>
        }
      />

      {hasTrips ? (
        <SegmentTabs
          options={[
            { id: 'all', label: 'All trips' },
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'completed', label: 'Completed' },
          ]}
          value={filter}
          onChange={setFilter}
        />
      ) : null}

      {isLoading ? (
        <View style={{ marginTop: spacing.md }}>
          <CardSkeleton />
          <CardSkeleton />
        </View>
      ) : filtered.length > 0 ? (
        <View style={{ paddingTop: spacing.sm }}>
          {filtered.map((trip, index) => {
            const { displayTitle, subtitle } = tripCardLabels(trip)
            return (
              <ItineraryCard
                key={trip.id}
                title={displayTitle}
                subtitle={subtitle}
                dates={formatTripDates(trip.start_date, trip.end_date)}
                imageUri={tripImageUri(trip)}
                status={tripCardStatus(trip.status)}
                gapAfter={index === filtered.length - 1 ? 0 : spacing.xl}
                onPress={() => router.push(`/trip/${trip.id}`)}
                onDelete={() => confirmDelete({ tripId: trip.id, tripTitle: displayTitle })}
              />
            )
          })}
        </View>
      ) : hasTrips ? (
        <EmptyState
          icon={Map}
          title="No trips in this view"
          description="Try another filter or plan a new adventure."
          actionLabel="Plan a trip"
          onAction={() => router.push('/trip/wizard')}
        />
      ) : (
        <EmptyState
          icon={Map}
          title="No trips yet"
          description="Use AI Chat or the trip wizard to build your first itinerary."
          actionLabel="Plan a trip"
          onAction={() => router.push('/trip/wizard')}
        />
      )}
    </ScreenWrapper>
  )
}
