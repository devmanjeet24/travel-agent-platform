import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { ChevronRight, LogOut, Settings } from 'lucide-react-native'

import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import ScreenWrapper from '@/components/ui/ScreenWrapper'
import { brand } from '@/constants/design'
import { useResponsive } from '@/hooks/use-responsive'
import { cardShadow, radii } from '@/lib/ui-styles'
import { useProfileQuery } from '@/hooks/profile/use-profile-query'
import { useSignOutMutation } from '@/hooks/auth/use-sign-out-mutation'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import { useAuth } from '@/providers/auth-provider'

export default function ProfileScreen() {
  const router = useRouter()
  const theme = useThemedStyles()
  const { user, displayName } = useAuth()
  const { data: profile, isLoading } = useProfileQuery()
  const signOutMutation = useSignOutMutation()
  const { scaleFont, isDesktop } = useResponsive()

  const email = user?.email ?? ''
  const name = profile?.display_name ?? displayName

  const handleSignOut = () => {
    signOutMutation.mutate(undefined, {
      onSettled: () => {
        router.replace('/(auth)/login')
      },
    })
  }

  const menuItems = [
    { label: 'Settings', icon: Settings, route: '/settings' as const },
  ]

  return (
    <ScreenWrapper scroll tabInset>
      <View
        style={[
          {
            marginTop: 8,
            borderRadius: radii.xl,
            padding: isDesktop ? 28 : 22,
            backgroundColor: brand.primaryDark,
            alignItems: 'center',
          },
          cardShadow(theme.isDark),
        ]}
      >
        <Avatar uri={profile?.avatar_url ?? undefined} name={name} size="lg" />
        <Text
          style={{
            color: brand.onPrimary,
            fontSize: scaleFont(22),
            fontWeight: '800',
            marginTop: 14,
          }}
        >
          {name}
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.8)', marginTop: 6, fontSize: 14 }}>{email}</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={brand.primaryDark} />
      ) : (
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
          {[
            { label: 'Trips', value: profile?.trips_count ?? 0 },
            { label: 'Countries', value: profile?.countries_visited ?? 0 },
            { label: 'AI plans', value: profile?.ai_plans_generated ?? 0 },
          ].map((stat) => (
            <View
              key={stat.label}
              style={[
                {
                  flex: 1,
                  alignItems: 'center',
                  padding: 16,
                  borderRadius: radii.lg,
                  backgroundColor: theme.colors.card,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                },
                cardShadow(theme.isDark, false),
              ]}
            >
              <Text
                style={{
                  color: brand.primaryDark,
                  fontSize: 24,
                  fontWeight: '800',
                }}
              >
                {stat.value}
              </Text>
              <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 4 }}>
                {stat.label}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={{ marginTop: 24, gap: 10 }}>
        {menuItems.map((item) => {
          const Icon = item.icon
          return (
            <Card key={item.label} onPress={() => router.push(item.route)}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radii.md,
                    backgroundColor: brand.primaryLight,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 14,
                  }}
                >
                  <Icon size={20} color={brand.primaryDark} />
                </View>
                <Text style={{ color: theme.colors.text, flex: 1, fontWeight: '600', fontSize: 16 }}>
                  {item.label}
                </Text>
                <ChevronRight size={20} color={theme.colors.icon} />
              </View>
            </Card>
          )
        })}
      </View>

      <Button
        title={signOutMutation.isPending ? 'Signing out…' : 'Sign out'}
        variant="danger"
        onPress={handleSignOut}
        disabled={signOutMutation.isPending}
        style={{ marginTop: 20 }}
      />

      <Button
        title="Edit profile"
        variant="outline"
        style={{ marginTop: 12, maxWidth: isDesktop ? 280 : undefined, alignSelf: isDesktop ? 'flex-start' : 'stretch' }}
      />
    </ScreenWrapper>
  )
}
