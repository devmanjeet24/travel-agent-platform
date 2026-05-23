import { useState } from 'react'
import { Alert, Pressable, Text, View } from 'react-native'
import { Link, useRouter } from 'expo-router'

import { PrimaryAuthButton } from '@/components/auth/PrimaryAuthButton'
import { SocialAuthButtons } from '@/components/auth/SocialAuthButtons'
import { AuthShell } from '@/components/ui/AuthShell'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { brand } from '@/constants/design'
import { isWeb } from '@/lib/ui-styles'
import { useResetPasswordMutation } from '@/hooks/auth/use-reset-password-mutation'
import { useSignInMutation } from '@/hooks/auth/use-sign-in-mutation'
import { useSignOutMutation } from '@/hooks/auth/use-sign-out-mutation'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import { useAuth } from '@/providers/auth-provider'

export default function LoginScreen() {
  const router = useRouter()
  const { colors } = useThemedStyles()
  const { isConfigured, session } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const signInMutation = useSignInMutation()
  const resetPasswordMutation = useResetPasswordMutation()
  const signOutMutation = useSignOutMutation()
  const loading = signInMutation.isPending

  const handleSignIn = () => {
    setError(null)
    if (!email.trim() || !password) {
      setError('Email and password are required.')
      return
    }
    signInMutation.mutate(
      { email: email.trim(), password },
      {
        onSuccess: ({ error: authError }) => {
          if (authError) {
            setError(authError)
            return
          }
          router.replace('/(tabs)')
        },
      },
    )
  }

  const handleForgotPassword = () => {
    if (!email.trim()) {
      Alert.alert('Reset password', 'Enter your email above first.')
      return
    }
    resetPasswordMutation.mutate(
      { email: email.trim() },
      {
        onSettled: (data) => {
          const resetError = data?.error ?? null
          Alert.alert(
            resetError ? 'Could not send reset email' : 'Check your email',
            resetError ?? 'If an account exists, a reset link was sent.',
          )
        },
      },
    )
  }

  const handleSignOut = () => {
    signOutMutation.mutate(undefined, {
      onSettled: () => router.replace('/(auth)/login'),
    })
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to continue planning with your AI travel agent."
    >
      {session ? (
        <View style={{ marginBottom: 20, gap: 12 }}>
          <Text style={{ color: colors.textMuted, textAlign: 'center', fontSize: 14 }}>
            You are already signed in.
          </Text>
          <Button title="Go to app" onPress={() => router.replace('/(tabs)')} />
          <Button title="Sign out" variant="outline" onPress={handleSignOut} />
        </View>
      ) : null}

      {!isConfigured ? (
        <Text style={{ color: brand.warning, fontSize: 13, textAlign: 'center', marginBottom: 16 }}>
          Supabase is not configured. Copy .env.example to .env and add your keys.
        </Text>
      ) : null}

      {!session ? (
        <View style={{ width: '100%' }}>
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
            showPasswordToggle
            value={password}
            onChangeText={setPassword}
            returnKeyType="go"
            onSubmitEditing={handleSignIn}
          />

          {error ? (
            <Text
              style={{
                color: brand.danger,
                fontSize: 14,
                marginTop: -8,
                marginBottom: 12,
              }}
            >
              {error}
            </Text>
          ) : null}

          <PrimaryAuthButton
            title="Sign in"
            loading={loading}
            onPress={handleSignIn}
          />

          <Pressable
            onPress={handleForgotPassword}
            style={{ alignSelf: 'center', marginTop: 12, marginBottom: 16, paddingVertical: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Forgot password"
          >
            <Text style={{ color: brand.primaryDark, fontWeight: '600', fontSize: 14 }}>
              Forgot password?
            </Text>
          </Pressable>

          <SocialAuthButtons onError={setError} />

          <Text
            style={{
              color: colors.textMuted,
              textAlign: 'center',
              marginTop: isWeb ? 24 : 20,
              fontSize: 15,
            }}
          >
            Don&apos;t have an account?{' '}
            <Link href="/(auth)/signup" asChild>
              <Text style={{ color: brand.primaryDark, fontWeight: '700' }}>Sign up</Text>
            </Link>
          </Text>
        </View>
      ) : null}
    </AuthShell>
  )
}
