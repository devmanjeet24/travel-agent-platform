import { useEffect, useState } from 'react'
import { ActivityIndicator, Image, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Star, Thermometer, Users } from 'lucide-react-native'

import { RequireSession } from '@/components/auth/require-session'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import ScreenWrapper from '@/components/ui/ScreenWrapper'
import { brand, defaultTripImage } from '@/constants/design'
import { fetchWeatherForDestination } from '@/services/travel/travel-api'
import type { WeatherResult } from '@/types/database'
import { useThemedStyles } from '@/hooks/use-themed-styles'

export default function DestinationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const theme = useThemedStyles()
  const destination = decodeURIComponent(id ?? 'Destination')
  const [weather, setWeather] = useState<WeatherResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        const w = await fetchWeatherForDestination(destination)
        setWeather(w)
      } finally {
        setLoading(false)
      }
    })()
  }, [destination])

  const avgTemp = weather?.daily?.[0]
    ? Math.round((weather.daily[0].tempMaxC + weather.daily[0].tempMinC) / 2)
    : null

  return (
    <RequireSession>
      <ScreenWrapper scroll padded={false}>
        <Image source={{ uri: defaultTripImage }} className="w-full h-56" />
        <View className="px-5 pb-8">
          <ScreenHeader title={destination.split(',')[0]} subtitle={destination} showBack />

          {loading ? (
            <ActivityIndicator className="my-6" color={brand.primaryDark} />
          ) : (
            <View className="flex-row gap-4 mb-6">
              <View className="flex-row items-center gap-1">
                <Star size={18} color="#F59E0B" fill="#F59E0B" />
                <Text className={`${theme.text} font-semibold`}>Live data</Text>
              </View>
              <View className="flex-row items-center gap-1">
                <Thermometer size={18} color={brand.primaryDark} />
                <Text className={`${theme.textMuted} text-sm`}>
                  {avgTemp != null ? `${avgTemp}°C avg` : 'Weather N/A'}
                </Text>
              </View>
              <View className="flex-row items-center gap-1">
                <Users size={18} color={brand.accent} />
                <Text className={`${theme.textMuted} text-sm`}>Open-Meteo</Text>
              </View>
            </View>
          )}

          <Card>
            <Text className={`${theme.text} font-semibold text-lg`}>Weather forecast</Text>
            <Text className={`${theme.textMuted} mt-2 leading-6`}>
              {weather?.summary ??
                'Could not load weather. Check your connection and try again.'}
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
