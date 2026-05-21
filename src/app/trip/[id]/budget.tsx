import { ActivityIndicator, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'

import { BudgetChart } from '@/components/ui/BudgetChart'
import { useTripBudgetQuery } from '@/hooks/trips/use-trip-query'
import { useThemedStyles } from '@/hooks/use-themed-styles'

export default function BudgetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const theme = useThemedStyles()
  const { data: categories, isLoading } = useTripBudgetQuery(id)

  if (isLoading) {
    return (
      <View className={`flex-1 ${theme.bg} items-center justify-center`}>
        <ActivityIndicator color="#0EA5E9" />
      </View>
    )
  }

  const chartCategories =
    categories?.map((c) => ({
      label: c.label,
      amount: Number(c.amount_usd),
      color: c.color ?? '#64748B',
    })) ?? []

  const total = chartCategories.reduce((s, c) => s + c.amount, 0)

  return (
    <View className={`flex-1 ${theme.bg} px-5 pb-8`}>
      <BudgetChart categories={chartCategories} total={total} />
    </View>
  )
}
