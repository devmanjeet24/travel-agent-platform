import { Platform, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'

import { Card } from '@/components/ui/Card'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import ScreenWrapper from '@/components/ui/ScreenWrapper'
import { StatCard } from '@/components/ui/StatCard'
import { fetchTrips } from '@/services/trips/trip-api'
import { useThemedStyles } from '@/hooks/use-themed-styles'

export default function AdminDashboardScreen() {
  const theme = useThemedStyles()
  const { data: trips } = useQuery({
    queryKey: ['admin-trips'],
    queryFn: fetchTrips,
    enabled: Platform.OS === 'web',
  })

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

  const destinations = trips?.reduce<Record<string, number>>((acc, t) => {
    const key = t.destination.split(',')[0]?.trim() ?? t.destination
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  const popular = Object.entries(destinations ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)

  return (
    <ScreenWrapper scroll>
      <ScreenHeader
        title="Admin dashboard"
        subtitle="Your account · live from Supabase"
        showBack
      />

      <View className="flex-row flex-wrap gap-3">
        <View className="w-[48%]">
          <StatCard label="Your trips" value={trips?.length ?? 0} />
        </View>
        <View className="w-[48%]">
          <StatCard
            label="Saved"
            value={trips?.filter((t) => t.status === 'saved').length ?? 0}
          />
        </View>
      </View>

      <Text className={`${theme.text} text-xl font-bold mt-8 mb-3`}>
        Destinations in your trips
      </Text>
      {popular.length ? (
        popular.map(([name, count]) => (
          <Card key={name} className="mb-3 flex-row justify-between items-center">
            <Text className={`${theme.text} font-medium`}>{name}</Text>
            <Text className={`${theme.textMuted}`}>{count} trip(s)</Text>
          </Card>
        ))
      ) : (
        <Text className={`${theme.textMuted}`}>No trips yet.</Text>
      )}
    </ScreenWrapper>
  )
}
