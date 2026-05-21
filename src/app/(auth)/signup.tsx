import { useState } from 'react'
import { Text, View } from 'react-native'
import { Link, useRouter } from 'expo-router'

import { SocialAuthButtons } from '@/components/auth/SocialAuthButtons'
import { AuthShell } from '@/components/ui/AuthShell'
import { PrimaryAuthButton } from '@/components/auth/PrimaryAuthButton'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { brand } from '@/constants/design'
import { isWeb, radii } from '@/lib/ui-styles'
import { useSignUpMutation } from '@/hooks/auth/use-sign-up-mutation'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import { useAuth } from '@/providers/auth-provider'

export default function SignupScreen() {
  const router = useRouter()
  const { colors } = useThemedStyles()
  const { isConfigured } = useAuth()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirmationSent, setConfirmationSent] = useState(false)

  const signUpMutation = useSignUpMutation()
  const loading = signUpMutation.isPending

  const handleSignUp = () => {
    setError(null)
    setConfirmationSent(false)
    if (!email.trim() || password.length < 8) {
      setError('Use a valid email and password (min. 8 characters).')
      return
    }
    signUpMutation.mutate(
      {
        email: email.trim(),
        password,
        fullName: fullName.trim() || undefined,
      },
      {
        onSuccess: ({ error: authError, needsEmailConfirmation }) => {
          if (authError) {
            setError(authError)
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

      <Input
        label="Full name"
        placeholder="Alex Rivera"
        value={fullName}
        onChangeText={setFullName}
      />
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
        placeholder="Min. 8 characters"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        error={error ?? undefined}
      />

      <PrimaryAuthButton
        title={
          loading
            ? 'Creating account…'
            : confirmationSent
              ? 'Resend confirmation'
              : 'Create account'
        }
        loading={loading}
        onPress={handleSignUp}
      />

      <SocialAuthButtons onError={setError} />

      <Text
        style={{
          color: colors.textMuted,
          textAlign: 'center',
          marginTop: isWeb ? 24 : 20,
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
