import { Platform, Text, View } from 'react-native'
import { BarChart3, Globe, Users, Zap } from 'lucide-react-native'

import { Card } from '@/components/ui/Card'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import ScreenWrapper from '@/components/ui/ScreenWrapper'
import { StatCard } from '@/components/ui/StatCard'
import { useThemedStyles } from '@/hooks/use-themed-styles'

const stats = [
  { label: 'Total users', value: '12,480', icon: Users },
  { label: 'Trips generated', value: '8,920', icon: Globe },
  { label: 'Token usage (M)', value: '2.4', icon: Zap },
  { label: 'Active subs', value: '1,240', icon: BarChart3 },
]

const popularDestinations = [
  { name: 'Bali', count: 1240 },
  { name: 'Tokyo', count: 980 },
  { name: 'Paris', count: 870 },
  { name: 'Dubai', count: 720 },
]

export default function AdminDashboardScreen() {
  const theme = useThemedStyles()

  if (Platform.OS !== 'web') {
    return (
      <ScreenWrapper>
        <ScreenHeader title="Admin" showBack />
        <Text className={`${theme.textMuted} text-center mt-12`}>
          Admin dashboard is available on web only.
        </Text>
      </ScreenWrapper>
    )
  }

  return (
    <ScreenWrapper scroll>
      <ScreenHeader
        title="Admin dashboard"
        subtitle="Analytics · Web only"
        showBack
      />

      <View className="flex-row flex-wrap gap-3">
        {stats.map((s) => (
          <View key={s.label} className="w-[48%]">
            <StatCard label={s.label} value={s.value} />
          </View>
        ))}
      </View>

      <Text className={`${theme.text} text-xl font-bold mt-8 mb-3`}>
        Popular destinations
      </Text>
      {popularDestinations.map((d) => (
        <Card key={d.name} className="mb-3 flex-row justify-between items-center">
          <Text className={`${theme.text} font-medium`}>{d.name}</Text>
          <Text className={`${theme.textMuted}`}>{d.count} trips</Text>
        </Card>
      ))}
    </ScreenWrapper>
  )
}
