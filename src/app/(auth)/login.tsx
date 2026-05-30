import { useCallback, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native'
import { Link, useRouter } from 'expo-router'

import { PrimaryAuthButton } from '@/components/auth/PrimaryAuthButton'
import { SocialAuthButtons } from '@/components/auth/SocialAuthButtons'
import { AuthShell } from '@/components/ui/AuthShell'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { brand } from '@/constants/design'
import { AUTH_FOOTER_MARGIN_TOP } from '@/lib/layout-parity'
import { useResetPasswordMutation } from '@/hooks/auth/use-reset-password-mutation'
import { useSignInMutation } from '@/hooks/auth/use-sign-in-mutation'
import { useSignOutMutation } from '@/hooks/auth/use-sign-out-mutation'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import { useAuth } from '@/providers/auth-provider'
import {
  type AuthFieldErrors,
  validateResetPasswordEmail,
  validateSignInFields,
} from '@/utils/auth-validation'

export default function LoginScreen() {
  const router = useRouter()
  const { colors } = useThemedStyles()
  const { isConfigured, session } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)

  const signInMutation = useSignInMutation()
  const resetPasswordMutation = useResetPasswordMutation()
  const signOutMutation = useSignOutMutation()

  const isBusy =
    signInMutation.isPending ||
    resetPasswordMutation.isPending ||
    signOutMutation.isPending

  const clearFieldError = useCallback((field: keyof AuthFieldErrors) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }, [])

  const handleSignIn = () => {
    if (isBusy) return
    setFormError(null)

    if (!isConfigured) {
      setFormError('Supabase is not configured. Add your keys in .env first.')
      return
    }

    const result = validateSignInFields(email, password)
    if (!result.ok) {
      setFieldErrors(result.errors)
      return
    }
    setFieldErrors({})

    signInMutation.mutate(
      { email: result.email, password },
      {
        onSuccess: ({ error: authError }) => {
          if (authError) {
            setFormError(authError)
            return
          }
          router.replace('/(tabs)')
        },
      },
    )
  }

  const handleForgotPassword = () => {
    if (isBusy || resetPasswordMutation.isPending) return

    if (!isConfigured) {
      Alert.alert('Reset password', 'Supabase is not configured. Add your keys in .env first.')
      return
    }

    const result = validateResetPasswordEmail(email)
    if (!result.ok) {
      setFieldErrors({ email: result.message })
      return
    }
    setFieldErrors((prev) => {
      if (!prev.email) return prev
      const next = { ...prev }
      delete next.email
      return next
    })

    resetPasswordMutation.mutate(
      { email: result.email },
      {
        onSettled: (data) => {
          const resetError = data?.error ?? null
          Alert.alert(
            resetError ? 'Could not send reset email' : 'Check your email',
            resetError ??
              'If an account exists for this address, we sent a link to reset your password.',
          )
        },
      },
    )
  }

  const handleSignOut = () => {
    if (signOutMutation.isPending) return
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
          <Button
            title="Sign out"
            variant="outline"
            onPress={handleSignOut}
            disabled={signOutMutation.isPending}
          />
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
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            value={email}
            onChangeText={(text) => {
              setEmail(text)
              clearFieldError('email')
              setFormError(null)
            }}
            error={fieldErrors.email}
            editable={!isBusy}
            returnKeyType="next"
          />
          <Input
            label="Password"
            placeholder="••••••••"
            showPasswordToggle
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="password"
            textContentType="password"
            value={password}
            onChangeText={(text) => {
              setPassword(text)
              clearFieldError('password')
              setFormError(null)
            }}
            error={fieldErrors.password}
            editable={!isBusy}
            returnKeyType="go"
            onSubmitEditing={handleSignIn}
          />

          {formError ? (
            <Text
              accessibilityRole="alert"
              style={{
                color: brand.danger,
                fontSize: 14,
                marginTop: -8,
                marginBottom: 12,
                lineHeight: 20,
              }}
            >
              {formError}
            </Text>
          ) : null}

          <PrimaryAuthButton
            title="Sign in"
            loading={signInMutation.isPending}
            disabled={isBusy && !signInMutation.isPending}
            onPress={handleSignIn}
          />

          <Pressable
            onPress={handleForgotPassword}
            disabled={resetPasswordMutation.isPending || isBusy}
            style={{
              alignSelf: 'center',
              marginTop: 12,
              marginBottom: 16,
              paddingVertical: 8,
              opacity: resetPasswordMutation.isPending ? 0.6 : 1,
            }}
            accessibilityRole="button"
            accessibilityLabel="Forgot password"
            accessibilityState={{ disabled: resetPasswordMutation.isPending }}
          >
            {resetPasswordMutation.isPending ? (
              <ActivityIndicator color={brand.primaryDark} />
            ) : (
              <Text style={{ color: brand.primaryDark, fontWeight: '600', fontSize: 14 }}>
                Forgot password?
              </Text>
            )}
          </Pressable>

          <SocialAuthButtons onError={setFormError} disabled={isBusy} />

          <Text
            style={{
              color: colors.textMuted,
              textAlign: 'center',
              marginTop: AUTH_FOOTER_MARGIN_TOP,
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
