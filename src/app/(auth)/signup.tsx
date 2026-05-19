import { Text, View } from 'react-native'
import { Link, useRouter } from 'expo-router'
import { Plane } from 'lucide-react-native'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import ScreenWrapper from '@/components/ui/ScreenWrapper'
import { brand } from '@/constants/design'
import { useThemedStyles } from '@/hooks/use-themed-styles'

export default function SignupScreen() {
  const router = useRouter()
  const { colors } = useThemedStyles()

  return (
    <ScreenWrapper scroll>
      <View className="py-8">
        <View className="items-center mb-10">
          <View
            className="w-20 h-20 rounded-3xl items-center justify-center mb-5"
            style={{ backgroundColor: `${brand.primary}44` }}
          >
            <Plane size={40} color={brand.primaryDark} />
          </View>
          <Text
            className="text-4xl font-bold text-center"
            style={{ color: colors.text }}
          >
            Create account
          </Text>
          <Text
            className="mt-3 text-base text-center leading-6 px-2"
            style={{ color: colors.textMuted }}
          >
            Build your profile and start planning personalized trips.
          </Text>
        </View>

        <View className="gap-4">
          <Input label="Full name" placeholder="Alex Rivera" />
          <Input label="Email" placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
          <Input label="Password" placeholder="Min. 8 characters" secureTextEntry />
        </View>

        <Button title="Create account" className="mt-8" onPress={() => router.replace('/(tabs)')} />

        <Text className="text-center mt-8" style={{ color: colors.textMuted }}>
          Already have an account?{' '}
          <Link href="/(auth)/login" asChild>
            <Text style={{ color: brand.primaryDark }} className="font-semibold">
              Sign in
            </Text>
          </Link>
        </Text>
      </View>
    </ScreenWrapper>
  )
}
