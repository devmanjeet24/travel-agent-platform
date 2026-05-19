import { Text, View } from 'react-native'
import { Plane } from 'lucide-react-native'

import { Card } from '@/components/ui/Card'
import { useThemedStyles } from '@/hooks/use-themed-styles'

const flights = [
  {
    airline: 'Garuda Indonesia',
    route: 'DEL → DPS',
    depart: '08:30',
    arrive: '14:15',
    price: '$490',
    stops: 'Non-stop',
  },
  {
    airline: 'Singapore Airlines',
    route: 'DEL → DPS',
    depart: '02:10',
    arrive: '11:40',
    price: '$520',
    stops: '1 stop · SIN',
  },
]

export default function FlightsScreen() {
  const theme = useThemedStyles()

  return (
    <View className={`flex-1 ${theme.bg} px-5 pb-8`}>
      {flights.map((f, i) => (
        <Card key={i} className="mb-4">
          <View className="flex-row items-center gap-2 mb-3">
            <Plane size={20} color="#0EA5E9" />
            <Text className={`${theme.text} font-bold`}>{f.airline}</Text>
          </View>
          <Text className={`${theme.text} text-lg font-semibold`}>{f.route}</Text>
          <Text className={`${theme.textMuted} mt-2`}>
            {f.depart} → {f.arrive} · {f.stops}
          </Text>
          <Text className="text-sky-500 font-bold text-xl mt-3">{f.price}</Text>
        </Card>
      ))}
    </View>
  )
}
