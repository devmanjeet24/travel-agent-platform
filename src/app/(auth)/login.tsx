import { Pressable, Text, View } from 'react-native'
import { Link, useRouter } from 'expo-router'
import { Plane } from 'lucide-react-native'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import ScreenWrapper from '@/components/ui/ScreenWrapper'
import { brand } from '@/constants/design'
import { useThemedStyles } from '@/hooks/use-themed-styles'

export default function LoginScreen() {
  const router = useRouter()
  const { colors } = useThemedStyles()

  return (
    <ScreenWrapper>
      <View className="flex-1 justify-center py-8">
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
            Welcome back
          </Text>
          <Text
            className="mt-3 text-base text-center leading-6 px-2"
            style={{ color: colors.textMuted }}
          >
            Sign in to continue planning with your AI travel agent.
          </Text>
        </View>

        <View className="gap-4">
          <Input label="Email" placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
          <Input label="Password" placeholder="••••••••" secureTextEntry />
        </View>

        <Pressable className="mt-3 self-end">
          <Text style={{ color: brand.primaryDark }} className="font-medium">
            Forgot password?
          </Text>
        </Pressable>

        <Button title="Sign in" className="mt-6" onPress={() => router.replace('/(tabs)')} />

        <View className="flex-row gap-3 mt-5">
          <Button title="Google" variant="outline" className="flex-1" onPress={() => router.replace('/(tabs)')} />
          <Button title="Apple" variant="outline" className="flex-1" onPress={() => router.replace('/(tabs)')} />
        </View>

        <Text className="text-center mt-8" style={{ color: colors.textMuted }}>
          Don&apos;t have an account?{' '}
          <Link href="/(auth)/signup" asChild>
            <Text style={{ color: brand.primaryDark }} className="font-semibold">
              Sign up
            </Text>
          </Link>
        </Text>
      </View>
    </ScreenWrapper>
  )
}
