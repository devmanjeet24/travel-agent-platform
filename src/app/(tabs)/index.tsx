import { Image, Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Sparkles } from 'lucide-react-native'

import { QuickActionCard } from '@/components/ui/QuickActionCard'
import { DestinationCard } from '@/components/ui/DestinationCard'
import { StatCard } from '@/components/ui/StatCard'
import ScreenWrapper from '@/components/ui/ScreenWrapper'
import {
  mockDestinations,
  mockUpcomingTrip,
  mockUser,
  quickActions,
} from '@/constants/design'
import { useThemedStyles } from '@/hooks/use-themed-styles'

export default function HomeScreen() {
  const router = useRouter()
  const theme = useThemedStyles()
  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <ScreenWrapper scroll>
      <Text className={`${theme.textMuted} text-base`}>{greeting}</Text>
      <Text className={`${theme.text} text-3xl font-bold mt-1`}>
        {mockUser.name.split(' ')[0]} 👋
      </Text>

      <Pressable
        onPress={() => router.push(`/trip/${mockUpcomingTrip.id}`)}
        className="mt-6 rounded-3xl overflow-hidden active:opacity-95"
      >
        <Image
          source={{ uri: mockUpcomingTrip.image }}
          className="w-full h-44"
        />
        <View className="absolute inset-0 bg-black/45 p-5 justify-end">
          <Text className="text-sky-300 text-sm font-medium">
            Upcoming · {mockUpcomingTrip.daysLeft} days left
          </Text>
          <Text className="text-white text-2xl font-bold mt-1">
            {mockUpcomingTrip.destination}
          </Text>
          <Text className="text-slate-200 mt-1">{mockUpcomingTrip.dates}</Text>
        </View>
      </Pressable>

      <View className="flex-row flex-wrap justify-between mt-8">
        {quickActions.map((action) => (
          <QuickActionCard
            key={action.id}
            label={action.label}
            icon={action.icon}
            onPress={() => router.push(action.route as never)}
          />
        ))}
      </View>

      <Text className={`${theme.text} text-xl font-bold mt-4`}>Travel stats</Text>
      <View className="flex-row flex-wrap gap-3 mt-3">
        <StatCard label="Trips" value={mockUser.tripsCount} />
        <StatCard label="Countries" value={mockUser.countriesVisited} accent="#8B5CF6" />
        <StatCard label="AI plans" value={mockUser.aiPlansGenerated} accent="#10B981" />
      </View>

      <View className={`${theme.bgCard} ${theme.border} border rounded-3xl p-5 mt-6 flex-row items-center`}>
        <View className="bg-violet-500/20 p-3 rounded-2xl mr-4">
          <Sparkles size={24} color="#8B5CF6" />
        </View>
        <View className="flex-1">
          <Text className={`${theme.text} font-semibold`}>AI suggestion</Text>
          <Text className={`${theme.textMuted} text-sm mt-1 leading-5`}>
            September is ideal for Japan — mild weather and fewer crowds.
          </Text>
        </View>
      </View>

      <Text className={`${theme.text} text-xl font-bold mt-8`}>
        Recently viewed
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3 -mx-1">
        {mockDestinations.map((d) => (
          <DestinationCard
            key={d.id}
            compact
            {...d}
            onPress={() => router.push(`/destination/${d.id}`)}
          />
        ))}
      </ScrollView>
    </ScreenWrapper>
  )
}
