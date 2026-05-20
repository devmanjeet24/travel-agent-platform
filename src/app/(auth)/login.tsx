import { useState } from 'react'
import { Alert, Pressable, Text, View } from 'react-native'
import { Link, useRouter } from 'expo-router'
import { Plane } from 'lucide-react-native'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import ScreenWrapper from '@/components/ui/ScreenWrapper'
import { brand } from '@/constants/design'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import { useAuth } from '@/providers/auth-provider'
import { resetPassword, signInWithEmail } from '@/services/auth.service'

export default function LoginScreen() {
  const router = useRouter()
  const { colors } = useThemedStyles()
  const { isConfigured } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSignIn = async () => {
    setError(null)
    if (!email.trim() || !password) {
      setError('Email and password are required.')
      return
    }
    setLoading(true)
    const { error: authError } = await signInWithEmail(email.trim(), password)
    setLoading(false)
    if (authError) {
      setError(authError)
      return
    }
    router.replace('/(tabs)')
  }

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Reset password', 'Enter your email above first.')
      return
    }
    const { error: resetError } = await resetPassword(email.trim())
    Alert.alert(
      resetError ? 'Could not send reset email' : 'Check your email',
      resetError ?? 'If an account exists, a reset link was sent.',
    )
  }

  const handleOAuthPlaceholder = (provider: string) => {
    Alert.alert(
      `${provider} sign-in`,
      `Enable ${provider} under Supabase → Authentication → Providers, then wire OAuth here.`,
    )
  }

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

        {!isConfigured ? (
          <Text className="text-amber-600 text-sm text-center mb-4 px-2">
            Supabase is not configured. Copy .env.example to .env and add your keys.
          </Text>
        ) : null}

        <View className="gap-4">
          <Input
            label="Email"
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <Input
            label="Password"
            placeholder="••••••••"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            error={error ?? undefined}
          />
        </View>

        <Pressable className="mt-3 self-end" onPress={handleForgotPassword}>
          <Text style={{ color: brand.primaryDark }} className="font-medium">
            Forgot password?
          </Text>
        </Pressable>

        <Button
          title={loading ? 'Signing in…' : 'Sign in'}
          className="mt-6"
          onPress={handleSignIn}
        />

        <View className="flex-row gap-3 mt-5">
          <Button
            title="Google"
            variant="outline"
            className="flex-1"
            onPress={() => handleOAuthPlaceholder('Google')}
          />
          <Button
            title="Apple"
            variant="outline"
            className="flex-1"
            onPress={() => handleOAuthPlaceholder('Apple')}
          />
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
