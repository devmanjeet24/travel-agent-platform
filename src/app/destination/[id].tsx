import { Image, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Star, Thermometer, Users } from 'lucide-react-native'

import { RequireSession } from '@/components/auth/require-session'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import ScreenWrapper from '@/components/ui/ScreenWrapper'
import { mockDestinations } from '@/constants/design'
import { useThemedStyles } from '@/hooks/use-themed-styles'

export default function DestinationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const theme = useThemedStyles()
  const destination =
    mockDestinations.find((d) => d.id === id) ?? mockDestinations[0]

  return (
    <RequireSession>
    <ScreenWrapper scroll padded={false}>
      <Image source={{ uri: destination.image }} className="w-full h-56" />
      <View className="px-5 pb-8">
        <ScreenHeader
          title={destination.name}
          subtitle={destination.country}
          showBack
        />

        <View className="flex-row gap-4 mb-6">
          <View className="flex-row items-center gap-1">
            <Star size={18} color="#F59E0B" fill="#F59E0B" />
            <Text className={`${theme.text} font-semibold`}>{destination.rating}</Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Thermometer size={18} color="#0EA5E9" />
            <Text className={`${theme.textMuted} text-sm`}>28°C avg</Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Users size={18} color="#8B5CF6" />
            <Text className={`${theme.textMuted} text-sm`}>Popular</Text>
          </View>
        </View>

        <Card>
          <Text className={`${theme.text} font-semibold text-lg`}>About</Text>
          <Text className={`${theme.textMuted} mt-2 leading-6`}>
            Discover temples, beaches, and vibrant culture. Ideal for 5–10 day trips
            with a mix of relaxation and adventure.
          </Text>
        </Card>

        <Button
          title="Plan trip with AI"
          className="mt-6"
          onPress={() => router.push('/(tabs)/chat')}
        />
        <Button
          title="Open trip wizard"
          variant="outline"
          className="mt-3"
          onPress={() => router.push('/trip/wizard')}
        />
      </View>
    </ScreenWrapper>
    </RequireSession>
  )
}
