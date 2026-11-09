import { ActivityIndicator, Text, View } from 'react-native'

import { Button } from '@/components/ui/Button'
import TripScreenWrapper from '@/components/trip/TripScreenWrapper'
import { brand } from '@/constants/design'
import { useThemedStyles } from '@/hooks/use-themed-styles'

type Props = {
  title?: string
  subtitle?: string
  error?: Error | null
  onRetry?: () => void
  centered?: boolean
}

export function TripPlanPending({
  title = 'Building your trip plan…',
  subtitle = 'Generating itinerary, budget, packing list, and destination details.',
  error,
  onRetry,
  centered = true,
}: Props) {
  const theme = useThemedStyles()

  return (
    <TripScreenWrapper scroll={false} centered={centered} className={theme.bg}>
      <ActivityIndicator color={brand.primaryDark} size="large" />
      <Text className={`${theme.text} font-semibold text-base mt-4 text-center px-6`}>
        {error ? 'Could not generate trip plan' : title}
      </Text>
      <Text className={`${theme.textMuted} text-sm mt-2 text-center px-6 leading-5`}>
        {error
          ? error.message || 'Something went wrong while planning. Try again.'
          : subtitle}
      </Text>
      {error && onRetry ? (
        <View className="mt-6 w-full max-w-xs px-6">
          <Button title="Try again" onPress={onRetry} />
        </View>
      ) : null}
    </TripScreenWrapper>
  )
}
