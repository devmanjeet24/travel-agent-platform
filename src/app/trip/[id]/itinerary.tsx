import { Text, View } from 'react-native'
import { Clock, MapPin } from 'lucide-react-native'

import { Card } from '@/components/ui/Card'
import { useThemedStyles } from '@/hooks/use-themed-styles'

const days = [
  {
    day: 1,
    title: 'Arrival & Seminyak',
    activities: [
      { time: '14:00', name: 'Check-in at hotel', cost: '$120', transport: 'Taxi from airport' },
      { time: '18:00', name: 'Sunset at Petitenget Beach', cost: 'Free', transport: 'Walk' },
    ],
  },
  {
    day: 2,
    title: 'Ubud culture',
    activities: [
      { time: '09:00', name: 'Tegallalang Rice Terrace', cost: '$15', transport: 'Private driver' },
      { time: '13:00', name: 'Ubud Monkey Forest', cost: '$22', transport: 'Same driver' },
    ],
  },
]

export default function ItineraryScreen() {
  const theme = useThemedStyles()

  return (
    <View className={`flex-1 ${theme.bg} px-5 pb-8`}>
      {days.map((d) => (
        <View key={d.day} className="mb-6">
          <Text className={`${theme.text} text-lg font-bold`}>
            Day {d.day} · {d.title}
          </Text>
          {d.activities.map((a, i) => (
            <Card key={i} className="mt-3">
              <View className="flex-row items-center gap-2">
                <Clock size={16} color="#0EA5E9" />
                <Text className="text-sky-500 font-semibold">{a.time}</Text>
              </View>
              <Text className={`${theme.text} font-semibold text-base mt-2`}>
                {a.name}
              </Text>
              <Text className={`${theme.textMuted} text-sm mt-2`}>
                Est. {a.cost} · {a.transport}
              </Text>
              <View className="flex-row items-center mt-2 gap-1">
                <MapPin size={14} color="#94A3B8" />
                <Text className={`${theme.textMuted} text-xs`}>Notes: Book tickets in advance</Text>
              </View>
            </Card>
          ))}
        </View>
      ))}
    </View>
  )
}
