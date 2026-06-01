import { useCallback, useState } from 'react'
import { Text, View } from 'react-native'
import { Link, useRouter } from 'expo-router'

import { SocialAuthButtons } from '@/components/auth/SocialAuthButtons'
import { AuthShell } from '@/components/ui/AuthShell'
import { PrimaryAuthButton } from '@/components/auth/PrimaryAuthButton'
import { Input } from '@/components/ui/Input'
import { brand } from '@/constants/design'
import { AUTH_FOOTER_MARGIN_TOP } from '@/lib/layout-parity'
import { radii } from '@/lib/ui-styles'
import { useSignUpMutation } from '@/hooks/auth/use-sign-up-mutation'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import { useAuth } from '@/providers/auth-provider'
import {
  type AuthFieldErrors,
  validateSignUpFields,
} from '@/utils/auth-validation'

export default function SignupScreen() {
  const router = useRouter()
  const { colors } = useThemedStyles()
  const { isConfigured } = useAuth()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmationSent, setConfirmationSent] = useState(false)

  const signUpMutation = useSignUpMutation()
  const isBusy = signUpMutation.isPending

  const clearFieldError = useCallback((field: keyof AuthFieldErrors) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }, [])

  const handleSignUp = () => {
    if (isBusy) return
    setFormError(null)

    if (!isConfigured) {
      setFormError('Supabase is not configured. Add your keys in .env first.')
      return
    }

    const result = validateSignUpFields(email, password, confirmPassword, fullName)
    if (!result.ok) {
      setFieldErrors(result.errors)
      return
    }
    setFieldErrors({})

    signUpMutation.mutate(
      {
        email: result.email,
        password,
        fullName: result.fullName,
      },
      {
        onSuccess: ({ error: authError, needsEmailConfirmation }) => {
          if (authError) {
            setFormError(authError)
            return
          }
          if (needsEmailConfirmation) {
            setConfirmationSent(true)
            return
          }
          router.replace('/(tabs)')
        },
      },
    )
  }

  const showForm = !confirmationSent

  return (
    <AuthShell
      title="Create account"
      subtitle="Build your profile and start planning personalized trips."
    >
      {!isConfigured ? (
        <Text style={{ color: brand.warning, fontSize: 13, textAlign: 'center', marginBottom: 16 }}>
          Supabase is not configured. Copy .env.example to .env and add your keys.
        </Text>
      ) : null}

      {confirmationSent ? (
        <View
          style={{
            marginBottom: 16,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: brand.primary,
            backgroundColor: brand.primaryLight,
            padding: 16,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>Check your email</Text>
          <Text style={{ color: colors.textMuted, marginTop: 8, lineHeight: 22, fontSize: 15 }}>
            We sent a confirmation link to {email.trim()}. Open it, then sign in.
          </Text>
        </View>
      ) : null}

      {showForm ? (
        <>
          <Input
            label="Full name"
            placeholder="Alex Rivera"
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            value={fullName}
            onChangeText={(text) => {
              setFullName(text)
              clearFieldError('fullName')
              setFormError(null)
            }}
            error={fieldErrors.fullName}
            editable={!isBusy}
            returnKeyType="next"
          />
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
            placeholder="Min. 8 characters"
            showPasswordToggle
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            value={password}
            onChangeText={(text) => {
              setPassword(text)
              clearFieldError('password')
              setFormError(null)
            }}
            error={fieldErrors.password}
            editable={!isBusy}
            returnKeyType="next"
          />
          <Input
            label="Confirm password"
            placeholder="Re-enter your password"
            showPasswordToggle
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text)
              clearFieldError('confirmPassword')
              setFormError(null)
            }}
            error={fieldErrors.confirmPassword}
            editable={!isBusy}
            returnKeyType="go"
            onSubmitEditing={handleSignUp}
          />
        </>
      ) : null}

      {formError ? (
        <Text
          accessibilityRole="alert"
          style={{
            color: brand.danger,
            fontSize: 14,
            marginBottom: 12,
            lineHeight: 20,
          }}
        >
          {formError}
        </Text>
      ) : null}

      <PrimaryAuthButton
        title={
          signUpMutation.isPending
            ? 'Creating account…'
            : confirmationSent
              ? 'Resend confirmation'
              : 'Create account'
        }
        loading={signUpMutation.isPending}
        disabled={isBusy && !signUpMutation.isPending}
        onPress={handleSignUp}
      />

      <SocialAuthButtons onError={setFormError} disabled={isBusy} />

      <Text
        style={{
          color: colors.textMuted,
          textAlign: 'center',
          marginTop: AUTH_FOOTER_MARGIN_TOP,
          fontSize: 15,
        }}
      >
        Already have an account?{' '}
        <Link href="/(auth)/login" asChild>
          <Text style={{ color: brand.primaryDark, fontWeight: '700' }}>Sign in</Text>
        </Link>
      </Text>
    </AuthShell>
  )
}
