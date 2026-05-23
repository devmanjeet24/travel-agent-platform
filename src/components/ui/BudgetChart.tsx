import { Text, View } from 'react-native'

import { useThemedStyles } from '@/hooks/use-themed-styles'
import { formatInr } from '@/utils/currency'

export interface BudgetCategory {
  label: string
  amount: number
  color: string
}

interface Props {
  categories: BudgetCategory[]
  total: number
}

export function BudgetChart({ categories, total }: Props) {
  const theme = useThemedStyles()
  const max = Math.max(...categories.map((c) => c.amount), 1)

  return (
    <View>
      <Text className={`${theme.text} text-3xl font-bold`}>{formatInr(total)}</Text>
      <Text className={`${theme.textMuted} text-sm mt-1`}>Estimated total (INR)</Text>

      <View className="mt-6 gap-4">
        {categories.map((cat) => (
          <View key={cat.label}>
            <View className="flex-row justify-between mb-1.5">
              <Text className={`${theme.text} text-sm font-medium`}>{cat.label}</Text>
              <Text className={`${theme.textMuted} text-sm`}>{formatInr(cat.amount)}</Text>
            </View>
            <View className={`${theme.bgMuted} h-2.5 rounded-full overflow-hidden`}>
              <View
                className="h-full rounded-full"
                style={{
                  width: `${(cat.amount / max) * 100}%`,
                  backgroundColor: cat.color,
                }}
              />
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}

export default BudgetChart
