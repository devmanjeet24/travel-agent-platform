import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Link, useRouter } from 'expo-router'
import { Plane } from 'lucide-react-native'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import ScreenWrapper from '@/components/ui/ScreenWrapper'
import { brand } from '@/constants/design'
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
    <ScreenWrapper scroll>
      <View style={styles.header}>
        <View
          style={[styles.iconBox, { backgroundColor: `${brand.primary}44` }]}
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

      {!isConfigured ? (
        <Text className="text-amber-600 text-sm text-center mb-4 px-2">
          Supabase is not configured. Copy .env.example to .env and add your
          keys.
        </Text>
      ) : null}

      {confirmationSent ? (
        <View
          style={[
            styles.confirmationBox,
            {
              backgroundColor: `${brand.primary}18`,
              borderColor: `${brand.primary}44`,
            },
          ]}
        >
          <Text
            className="font-semibold text-base"
            style={{ color: colors.text }}
          >
            Check your email
          </Text>
          <Text
            className="mt-2 text-[15px] leading-[22px]"
            style={{ color: colors.textMuted }}
          >
            We sent a confirmation link to {email.trim()}. Open it, then come
            back here to sign in.
          </Text>
        </View>
      ) : null}

      <View className="gap-4">
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
      </View>

      <Button
        title={
          loading
            ? 'Creating account…'
            : confirmationSent
              ? 'Resend confirmation'
              : 'Create account'
        }
        onPress={handleSignUp}
        className="mt-7"
      />

      <Text className="text-center mt-7 text-[15px]" style={{ color: colors.textMuted }}>
        Already have an account?{' '}
        <Link href="/(auth)/login" asChild>
          <Text style={{ color: brand.primaryDark }} className="font-semibold">
            Sign in
          </Text>
        </Link>
      </Text>
    </ScreenWrapper>
  )
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginBottom: 28,
    marginTop: 8,
  },
  iconBox: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  confirmationBox: {
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
})
