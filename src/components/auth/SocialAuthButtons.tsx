import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'

import { brand } from '@/constants/design'
import { useOAuthSignInMutation } from '@/hooks/auth/use-oauth-sign-in-mutation'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import { cardShadow, radii } from '@/lib/ui-styles'

interface Props {
  onError?: (message: string) => void
  /** Disable while email/password auth is in flight. */
  disabled?: boolean
}

export function SocialAuthButtons({ onError, disabled }: Props) {
  const router = useRouter()
  const theme = useThemedStyles()
  const oauth = useOAuthSignInMutation()
  const loading = oauth.isPending
  const loadingProvider = oauth.variables
  const isDisabled = disabled || loading

  const handleOAuth = (provider: 'google' | 'apple') => {
    if (isDisabled) return
    oauth.mutate(provider, {
      onSuccess: ({ error }) => {
        if (error) {
          onError?.(error)
          return
        }
        router.replace('/(tabs)')
      },
    })
  }

  return (
    <View style={{ gap: 12, marginTop: 8 }}>
      <Text
        style={{
          color: theme.colors.textMuted,
          textAlign: 'center',
          fontSize: 13,
          fontWeight: '500',
        }}
      >
        or continue with
      </Text>

      <Pressable
        onPress={() => handleOAuth('google')}
        disabled={isDisabled}
        accessibilityState={{ disabled: isDisabled }}
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            backgroundColor: theme.colors.card,
            borderWidth: 1.5,
            borderColor: theme.colors.border,
            borderRadius: radii.pill,
            minHeight: 52,
            paddingHorizontal: 20,
            opacity: isDisabled && !loading ? 0.6 : 1,
          },
          cardShadow(theme.isDark, false),
        ]}
        className="active:opacity-90"
      >
        {loading && loadingProvider === 'google' ? (
          <ActivityIndicator color={brand.primaryDark} />
        ) : (
          <>
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: '#FFFFFF',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: '#E2E8F0',
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#4285F4' }}>G</Text>
            </View>
            <Text style={{ color: theme.colors.text, fontWeight: '600', fontSize: 16 }}>
              Continue with Google
            </Text>
          </>
        )}
      </Pressable>

      <Pressable
        onPress={() => handleOAuth('apple')}
        disabled={isDisabled}
        accessibilityState={{ disabled: isDisabled }}
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            backgroundColor: theme.isDark ? '#FFFFFF' : '#000000',
            borderRadius: radii.pill,
            minHeight: 52,
            paddingHorizontal: 20,
            opacity: isDisabled && !loading ? 0.6 : 1,
          },
          cardShadow(theme.isDark, false),
        ]}
        className="active:opacity-90"
      >
        {loading && loadingProvider === 'apple' ? (
          <ActivityIndicator color={theme.isDark ? '#000' : '#FFF'} />
        ) : (
          <>
            <Text
              style={{
                color: theme.isDark ? '#000000' : '#FFFFFF',
                fontWeight: '600',
                fontSize: 16,
              }}
            >
              Continue with Apple
            </Text>
          </>
        )}
      </Pressable>
    </View>
  )
}

export default SocialAuthButtons
