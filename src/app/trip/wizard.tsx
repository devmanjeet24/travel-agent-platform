import { Text, View } from 'react-native'
import { useRouter } from 'expo-router'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import ScreenWrapper from '@/components/ui/ScreenWrapper'
import { useThemedStyles } from '@/hooks/use-themed-styles'

export default function TripWizardScreen() {
  const router = useRouter()
  const theme = useThemedStyles()

  return (
    <ScreenWrapper scroll>
      <ScreenHeader
        title="Trip wizard"
        subtitle="Step 1 of 4 · Basics"
        showBack
      />

      <View className="gap-4">
        <Input label="Destination" placeholder="e.g. Bali, Indonesia" />
        <Input label="Travel dates" placeholder="12 Aug – 20 Aug 2026" />
        <Input label="Travelers" placeholder="2 adults" keyboardType="numeric" />
        <Input label="Budget (USD)" placeholder="3000" keyboardType="numeric" />
      </View>

      <Text className={`${theme.textMuted} text-sm mt-6 leading-5`}>
        The AI will use your answers to search flights, hotels, weather, and build a full itinerary.
      </Text>

      <Button
        title="Continue"
        className="mt-8"
        onPress={() => router.push('/(tabs)/chat')}
      />
    </ScreenWrapper>
  )
}
