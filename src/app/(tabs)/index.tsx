import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Sparkles } from 'lucide-react-native'

import { QuickActionCard } from '@/components/ui/QuickActionCard'
import { StatCard } from '@/components/ui/StatCard'
import ScreenWrapper from '@/components/ui/ScreenWrapper'
import { defaultTripImage, quickActions } from '@/constants/design'
import { useProfileQuery } from '@/hooks/profile/use-profile-query'
import { useTripsQuery } from '@/hooks/trips/use-trips-query'
import { formatTripDates, tripDaysUntil } from '@/services/trips/trip-api'
import { useAuth } from '@/providers/auth-provider'
import { useThemedStyles } from '@/hooks/use-themed-styles'

export default function HomeScreen() {
  const router = useRouter()
  const theme = useThemedStyles()
  const { displayName } = useAuth()
  const { data: profile } = useProfileQuery()
  const { data: trips, isLoading } = useTripsQuery()

  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const upcoming =
    trips?.find((t) => t.status === 'upcoming') ??
    trips?.find((t) => t.status === 'saved') ??
    trips?.[0]

  const firstName = displayName.split(' ')[0]

  return (
    <ScreenWrapper scroll>
      <Text className={`${theme.textMuted} text-base`}>{greeting}</Text>
      <Text className={`${theme.text} text-3xl font-bold mt-1`}>
        {firstName} 👋
      </Text>

      {isLoading ? (
        <ActivityIndicator className="mt-8" color="#0EA5E9" />
      ) : upcoming ? (
        <Pressable
          onPress={() => router.push(`/trip/${upcoming.id}`)}
          className="mt-6 rounded-3xl overflow-hidden active:opacity-95"
        >
          <Image
            source={{ uri: upcoming.image_url ?? defaultTripImage }}
            className="w-full h-44"
          />
          <View className="absolute inset-0 bg-black/45 p-5 justify-end">
            <Text className="text-sky-300 text-sm font-medium">
              {upcoming.status === 'upcoming' ? 'Upcoming' : 'Saved'}
              {tripDaysUntil(upcoming.start_date) != null
                ? ` · ${tripDaysUntil(upcoming.start_date)} days left`
                : ''}
            </Text>
            <Text className="text-white text-2xl font-bold mt-1">
              {upcoming.destination}
            </Text>
            <Text className="text-slate-200 mt-1">
              {formatTripDates(upcoming.start_date, upcoming.end_date)}
            </Text>
          </View>
        </Pressable>
      ) : (
        <Pressable
          onPress={() => router.push('/trip/wizard')}
          className={`mt-6 rounded-3xl p-6 ${theme.bgCard} border ${theme.border}`}
        >
          <Text className={`${theme.text} font-semibold text-lg`}>
            Create your first trip
          </Text>
          <Text className={`${theme.textMuted} mt-2`}>
            Use the trip wizard or AI chat to get started.
          </Text>
        </Pressable>
      )}

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
        <StatCard label="Trips" value={profile?.trips_count ?? trips?.length ?? 0} />
        <StatCard
          label="Countries"
          value={profile?.countries_visited ?? 0}
          accent="#8B5CF6"
        />
        <StatCard
          label="AI plans"
          value={profile?.ai_plans_generated ?? 0}
          accent="#10B981"
        />
      </View>

      <View
        className={`${theme.bgCard} ${theme.border} border rounded-3xl p-5 mt-6 flex-row items-center`}
      >
        <View className="bg-violet-500/20 p-3 rounded-2xl mr-4">
          <Sparkles size={24} color="#8B5CF6" />
        </View>
        <View className="flex-1">
          <Text className={`${theme.text} font-semibold`}>AI suggestion</Text>
          <Text className={`${theme.textMuted} text-sm mt-1 leading-5`}>
            {trips?.length
              ? 'Open AI Chat to refine your itinerary with live weather and prices.'
              : 'Start in AI Chat — we pull real weather, hotels, and flights into every reply.'}
          </Text>
        </View>
      </View>

      {trips && trips.length > 0 ? (
        <>
          <Text className={`${theme.text} text-xl font-bold mt-8`}>Recent trips</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3 -mx-1">
            {trips.slice(0, 5).map((t) => (
              <Pressable
                key={t.id}
                onPress={() => router.push(`/trip/${t.id}`)}
                className={`mr-3 w-40 rounded-2xl overflow-hidden ${theme.bgCard} border ${theme.border}`}
              >
                <Image
                  source={{ uri: t.image_url ?? defaultTripImage }}
                  className="w-full h-24"
                />
                <View className="p-3">
                  <Text className={`${theme.text} font-semibold`} numberOfLines={1}>
                    {t.title}
                  </Text>
                  <Text className={`${theme.textMuted} text-xs mt-1`} numberOfLines={1}>
                    {t.destination}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}
    </ScreenWrapper>
  )
}
