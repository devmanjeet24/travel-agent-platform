import { Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  FileDown,
  Map,
  Plane,
  Wallet,
  Hotel,
  ListChecks,
  Calendar,
} from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useThemedStyles } from '@/hooks/use-themed-styles'

const sections: { label: string; route: string; icon: LucideIcon }[] = [
  { label: 'Itinerary', route: 'itinerary', icon: Calendar },
  { label: 'Budget', route: 'budget', icon: Wallet },
  { label: 'Flights', route: 'flights', icon: Plane },
  { label: 'Hotels', route: 'hotels', icon: Hotel },
  { label: 'Map & routes', route: 'map', icon: Map },
  { label: 'Packing list', route: 'packing', icon: ListChecks },
]

export default function TripOverviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const theme = useThemedStyles()

  return (
    <View className={`flex-1 ${theme.bg} px-5 pb-8`}>
      <Card className="mt-2">
        <Text className={`${theme.text} text-2xl font-bold`}>Bali Adventure</Text>
        <Text className={`${theme.textMuted} mt-1`}>8 days · 2 travelers · Trip #{id}</Text>
        <Text className="text-sky-500 font-medium mt-3">Saved offline</Text>
      </Card>

      <Text className={`${theme.text} font-bold text-lg mt-6 mb-3`}>Trip modules</Text>
      {sections.map((s) => {
        const Icon = s.icon
        return (
          <Card
            key={s.route}
            onPress={() => router.push(`/trip/${id}/${s.route}` as never)}
            className="mb-3 flex-row items-center"
          >
            <View className="bg-sky-500/20 p-3 rounded-xl mr-4">
              <Icon size={22} color="#0EA5E9" />
            </View>
            <Text className={`${theme.text} font-semibold text-base flex-1`}>
              {s.label}
            </Text>
          </Card>
        )
      })}

      <Button
        title="Export PDF"
        variant="secondary"
        className="mt-4 flex-row gap-2"
        onPress={() => {}}
      />
      <View className="flex-row items-center justify-center mt-3 gap-2">
        <FileDown size={18} color="#8B5CF6" />
        <Text className={`${theme.textMuted} text-sm`}>Share itinerary & budget</Text>
      </View>
    </View>
  )
}
