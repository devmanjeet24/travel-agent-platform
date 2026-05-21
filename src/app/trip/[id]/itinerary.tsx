import { ActivityIndicator, Text, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { Clock, MapPin } from 'lucide-react-native'

import { Card } from '@/components/ui/Card'
import { useTripItineraryQuery } from '@/hooks/trips/use-trip-query'
import { useThemedStyles } from '@/hooks/use-themed-styles'

export default function ItineraryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const theme = useThemedStyles()
  const { data: days, isLoading } = useTripItineraryQuery(id)

  if (isLoading) {
    return (
      <View className={`flex-1 ${theme.bg} items-center justify-center`}>
        <ActivityIndicator color="#0EA5E9" />
      </View>
    )
  }

  if (!days?.length) {
    return (
      <View className={`flex-1 ${theme.bg} px-5 justify-center`}>
        <Text className={`${theme.textMuted} text-center`}>
          No itinerary yet. Use &quot;Regenerate AI plan&quot; on the trip overview.
        </Text>
      </View>
    )
  }

  return (
    <View className={`flex-1 ${theme.bg} px-5 pb-8`}>
      {days.map((d) => (
        <View key={d.id} className="mb-6">
          <Text className={`${theme.text} text-lg font-bold`}>
            Day {d.day_number}
            {d.title ? ` · ${d.title}` : ''}
          </Text>
          {d.activities.map((a) => (
            <Card key={a.id} className="mt-3">
              <View className="flex-row items-center gap-2">
                <Clock size={16} color="#0EA5E9" />
                <Text className="text-sky-500 font-semibold">
                  {a.activity_time ?? '—'}
                </Text>
              </View>
              <Text className={`${theme.text} font-semibold text-base mt-2`}>
                {a.name}
              </Text>
              <Text className={`${theme.textMuted} text-sm mt-2`}>
                Est. ${Number(a.cost_usd ?? 0)} · {a.transport ?? '—'}
              </Text>
              {a.notes ? (
                <View className="flex-row items-center mt-2 gap-1">
                  <MapPin size={14} color="#94A3B8" />
                  <Text className={`${theme.textMuted} text-xs`}>{a.notes}</Text>
                </View>
              ) : null}
            </Card>
          ))}
        </View>
      ))}
    </View>
  )
}
