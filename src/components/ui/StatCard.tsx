import { Text, View } from 'react-native'

import { useThemedStyles } from '@/hooks/use-themed-styles'

interface Props {
  label: string
  value: string | number
  accent?: string
}

export function StatCard({ label, value, accent = '#0EA5E9' }: Props) {
  const theme = useThemedStyles()

  return (
    <View
      className={`${theme.bgCard} ${theme.border} border rounded-2xl p-4 flex-1 min-w-[30%]`}
    >
      <Text style={{ color: accent }} className="text-2xl font-bold">
        {value}
      </Text>
      <Text className={`${theme.textMuted} text-xs mt-1`}>{label}</Text>
    </View>
  )
}

export default StatCard
