import { Text, View } from 'react-native'

import TripScreenWrapper from '@/components/trip/TripScreenWrapper'
import { TripPlanPending } from '@/components/trip/TripPlanPending'
import { useLocalSearchParams } from 'expo-router'
import { Clock, MapPin } from 'lucide-react-native'

import { TransportBadge } from '@/components/trip/TransportBadge'
import { Card } from '@/components/ui/Card'
import { useTripPlan } from '@/providers/trip-plan-provider'
import { useTripItineraryQuery, useTripQuery } from '@/hooks/trips/use-trip-query'
import { brand } from '@/constants/design'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import { resolveActivityCostInr } from '@/utils/activity-cost'
import { formatInr } from '@/utils/currency'
import {
  isLowTripBudget,
  parseTransport,
  tripDaysBetween,
} from '@/utils/transport-display'

export default function ItineraryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const theme = useThemedStyles()
  const { data: trip } = useTripQuery(id)
  const { data: days, isLoading } = useTripItineraryQuery(id)
  const { needsPlan, isPlanning, queriesLoading, planError, retryPlan } = useTripPlan()

  const lowBudget = isLowTripBudget(
    trip?.budget_usd ? Number(trip.budget_usd) : undefined,
    trip?.travelers ?? 1,
    tripDaysBetween(trip?.start_date ?? null, trip?.end_date ?? null),
  )

  if (isLoading || queriesLoading || (needsPlan && isPlanning)) {
    return <TripPlanPending />
  }

  if (needsPlan && planError) {
    return <TripPlanPending error={planError} onRetry={retryPlan} />
  }

  if (!days?.length) {
    return <TripPlanPending onRetry={retryPlan} />
  }

  return (
    <TripScreenWrapper className={theme.bg}>
      {days.map((d) => (
        <View key={d.id} className="mb-6">
          <Text className={`${theme.text} text-lg font-bold`}>
            Day {d.day_number}
            {d.title ? ` · ${d.title}` : ''}
          </Text>
          {d.activities.length === 0 ? (
            <Text className={`${theme.textMuted} text-sm mt-2`}>
              Activities for this day are still loading.
            </Text>
          ) : null}
          {d.activities.map((a) => {
            const transport = parseTransport(a.transport)
            const storedCost =
              a.cost_usd != null && Number(a.cost_usd) > 0 ? Number(a.cost_usd) : null
            const displayCost =
              storedCost ??
              resolveActivityCostInr({
                cost: a.cost_usd,
                name: a.name,
                transport: a.transport,
                travelers: trip?.travelers ?? 1,
              })
            return (
              <Card key={a.id} className="mt-3">
                <View className="flex-row items-center gap-2">
                  <Clock size={16} color={brand.primaryDark} />
                  <Text className="text-yellow-600 font-semibold">
                    {a.activity_time ?? '—'}
                  </Text>
                </View>
                <Text className={`${theme.text} font-semibold text-base mt-2`}>
                  {a.name}
                </Text>
                <Text className={`${theme.textMuted} text-sm mt-2`}>
                  {storedCost != null ? '' : 'Est. '}
                  {formatInr(displayCost)}
                </Text>
                {a.transport?.trim() ? (
                  <TransportBadge
                    icon={transport.icon}
                    label={transport.label}
                    detail={transport.detail}
                    budgetFriendly={transport.budgetFriendly}
                    showBudgetHint={lowBudget}
                  />
                ) : null}
                {a.notes ? (
                  <View className="flex-row items-center mt-2 gap-1">
                    <MapPin size={14} color="#94A3B8" />
                    <Text className={`${theme.textMuted} text-xs`}>{a.notes}</Text>
                  </View>
                ) : null}
              </Card>
            )
          })}
        </View>
      ))}
    </TripScreenWrapper>
  )
}
