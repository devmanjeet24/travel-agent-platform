import { View } from 'react-native'

import { BudgetChart } from '@/components/ui/BudgetChart'
import { useThemedStyles } from '@/hooks/use-themed-styles'

const categories = [
  { label: 'Flights', amount: 980, color: '#0EA5E9' },
  { label: 'Hotels', amount: 720, color: '#8B5CF6' },
  { label: 'Food', amount: 350, color: '#10B981' },
  { label: 'Local transport', amount: 120, color: '#F59E0B' },
  { label: 'Activities', amount: 280, color: '#EC4899' },
  { label: 'Miscellaneous', amount: 90, color: '#64748B' },
]

export default function BudgetScreen() {
  const theme = useThemedStyles()
  const total = categories.reduce((s, c) => s + c.amount, 0)

  return (
    <View className={`flex-1 ${theme.bg} px-5 pb-8`}>
      <BudgetChart categories={categories} total={total} />
    </View>
  )
}
