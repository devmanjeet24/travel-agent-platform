import { Pressable, Text, View } from 'react-native'
import { Link, useRouter } from 'expo-router'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import ScreenWrapper from '@/components/ui/ScreenWrapper'
import { useThemedStyles } from '@/hooks/use-themed-styles'

export default function LoginScreen() {
  const router = useRouter()
  const theme = useThemedStyles()

  return (
    <ScreenWrapper>
      <View className="flex-1 justify-center py-8">
        <Text className={`${theme.text} text-4xl font-bold`}>Welcome back</Text>
        <Text className={`${theme.textMuted} mt-3 text-base`}>
          Sign in to continue planning with your AI travel agent.
        </Text>

        <View className="mt-10 gap-4">
          <Input label="Email" placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
          <Input label="Password" placeholder="••••••••" secureTextEntry />
        </View>

        <Pressable className="mt-3 self-end">
          <Text className="text-sky-500 font-medium">Forgot password?</Text>
        </Pressable>

        <Button title="Sign in" className="mt-6" onPress={() => router.replace('/(tabs)')} />

        <View className="flex-row gap-3 mt-5">
          <Button title="Google" variant="outline" className="flex-1" onPress={() => router.replace('/(tabs)')} />
          <Button title="Apple" variant="outline" className="flex-1" onPress={() => router.replace('/(tabs)')} />
        </View>

        <Text className={`${theme.textMuted} text-center mt-8`}>
          Don&apos;t have an account?{' '}
          <Link href="/(auth)/signup" asChild>
            <Text className="text-sky-500 font-semibold">Sign up</Text>
          </Link>
        </Text>
      </View>
    </ScreenWrapper>
  )
}
