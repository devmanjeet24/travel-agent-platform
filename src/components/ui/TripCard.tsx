import { Text, View } from 'react-native'
import { ChevronRight } from 'lucide-react-native'

import { Card } from './Card'
import { useThemedStyles } from '@/hooks/use-themed-styles'

interface Props {
  title: string
  subtitle: string
  status?: 'upcoming' | 'saved' | 'completed'
  onPress?: () => void
}

const statusStyles = {
  upcoming: { bg: 'bg-sky-500/20', text: 'text-sky-400' },
  saved: { bg: 'bg-violet-500/20', text: 'text-violet-400' },
  completed: { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
}

export function TripCard({ title, subtitle, status = 'saved', onPress }: Props) {
  const theme = useThemedStyles()
  const badge = statusStyles[status]

  return (
    <Card onPress={onPress} className="mb-4 flex-row items-center">
      <View className="flex-1">
        <View className="flex-row items-center gap-2 mb-2">
          <View className={`px-2.5 py-1 rounded-full ${badge.bg}`}>
            <Text className={`text-xs font-semibold capitalize ${badge.text}`}>
              {status}
            </Text>
          </View>
        </View>
        <Text className={`${theme.text} text-xl font-bold`}>{title}</Text>
        <Text className={`${theme.textMuted} text-sm mt-1`}>{subtitle}</Text>
      </View>
      <ChevronRight size={22} color={theme.isDark ? '#94A3B8' : '#64748B'} />
    </Card>
  )
}

export default TripCard
