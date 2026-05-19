import { Text, View } from 'react-native'
import { Link, useRouter } from 'expo-router'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import ScreenWrapper from '@/components/ui/ScreenWrapper'
import { useThemedStyles } from '@/hooks/use-themed-styles'

export default function SignupScreen() {
  const router = useRouter()
  const theme = useThemedStyles()

  return (
    <ScreenWrapper scroll>
      <View className="py-8">
        <Text className={`${theme.text} text-4xl font-bold`}>Create account</Text>
        <Text className={`${theme.textMuted} mt-3 text-base`}>
          Build your profile and start planning personalized trips.
        </Text>

        <View className="mt-10 gap-4">
          <Input label="Full name" placeholder="Alex Rivera" />
          <Input label="Email" placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
          <Input label="Password" placeholder="Min. 8 characters" secureTextEntry />
        </View>

        <Button title="Create account" className="mt-8" onPress={() => router.replace('/(tabs)')} />

        <Text className={`${theme.textMuted} text-center mt-8`}>
          Already have an account?{' '}
          <Link href="/(auth)/login" asChild>
            <Text className="text-sky-500 font-semibold">Sign in</Text>
          </Link>
        </Text>
      </View>
    </ScreenWrapper>
  )
}
