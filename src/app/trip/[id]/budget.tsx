import { ActivityIndicator } from 'react-native'
import { useLocalSearchParams } from 'expo-router'

import { BudgetChart } from '@/components/ui/BudgetChart'
import TripScreenWrapper from '@/components/trip/TripScreenWrapper'
import { useTripBudgetQuery } from '@/hooks/trips/use-trip-query'
import { brand } from '@/constants/design'
import { useThemedStyles } from '@/hooks/use-themed-styles'

export default function BudgetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const theme = useThemedStyles()
  const { data: categories, isLoading } = useTripBudgetQuery(id)

  if (isLoading) {
    return (
      <TripScreenWrapper scroll={false} centered className={theme.bg}>
        <ActivityIndicator color={brand.primaryDark} />
      </TripScreenWrapper>
    )
  }

  const chartCategories =
    categories?.map((c) => ({
      label: c.label,
      amount: Number(c.amount_usd),
      color: c.color ?? '#737373',
    })) ?? []

  const total = chartCategories.reduce((s, c) => s + c.amount, 0)

  return (
    <TripScreenWrapper className={theme.bg}>
      <BudgetChart categories={chartCategories} total={total} />
    </TripScreenWrapper>
  )
}
