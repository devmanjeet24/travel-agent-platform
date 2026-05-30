import { Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { LogOut, Settings, UserPen } from 'lucide-react-native'
import { LinearGradient } from 'expo-linear-gradient'

import { ProfileAvatarEditor } from '@/components/profile/ProfileAvatarEditor'
import { MenuRow } from '@/components/ui/MenuRow'
import ScreenWrapper from '@/components/ui/ScreenWrapper'
import { StatCard } from '@/components/ui/StatCard'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { brand, spacing } from '@/constants/design'
import { textWithWeight } from '@/constants/inter-typography'
import { typography } from '@/constants/typography'
import { useResponsive } from '@/hooks/use-responsive'
import { cardShadow, radii } from '@/lib/ui-styles'
import { useJourneyStats } from '@/hooks/profile/use-journey-stats'
import { useSyncProfileStats } from '@/hooks/profile/use-sync-profile-stats'
import { useProfileQuery } from '@/hooks/profile/use-profile-query'
import { useSignOutMutation } from '@/hooks/auth/use-sign-out-mutation'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import { useAuth } from '@/providers/auth-provider'

export default function ProfileScreen() {
  const router = useRouter()
  const theme = useThemedStyles()
  const { user, displayName } = useAuth()
  const { data: profile, isLoading } = useProfileQuery()
  const { stats, isLoading: statsLoading } = useJourneyStats()
  useSyncProfileStats()
  const signOutMutation = useSignOutMutation()
  const { scaleFont, contentWidth } = useResponsive()
  const statGap = spacing.sm
  const statWidth = Math.floor((contentWidth - statGap * 2) / 3)

  const email = user?.email ?? ''
  const name = profile?.display_name ?? displayName

  const handleSignOut = () => {
    signOutMutation.mutate(undefined, {
      onSettled: () => router.replace('/(auth)/login'),
    })
  }

  return (
    <ScreenWrapper scroll tabInset scrollFlexGrow={false} subtleBackground>
      {/* Profile hero */}
      <View
        style={[
          {
            alignSelf: 'stretch',
            borderRadius: radii['2xl'],
            overflow: 'hidden',
            marginTop: spacing.sm,
          },
          cardShadow(theme.isDark),
        ]}
      >
        <LinearGradient
          colors={theme.isDark ? ['#1E3A8A', '#312E81'] : ['#2563EB', '#4F46E5']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: spacing['2xl'], alignItems: 'center' }}
        >
          <ProfileAvatarEditor uri={profile?.avatar_url ?? undefined} name={name} size="lg" />
          <Text
            style={textWithWeight(typography.h1, '800', {
              color: brand.onPrimary,
              fontSize: scaleFont(22),
              marginTop: spacing.lg,
            })}
            numberOfLines={1}
          >
            {name}
          </Text>
          <Text
            style={{ ...typography.bodySm, color: 'rgba(255,255,255,0.82)', marginTop: spacing.xs }}
            numberOfLines={1}
          >
            {email}
          </Text>
        </LinearGradient>
      </View>

      {/* Stats */}
      {isLoading || statsLoading ? (
        <View style={{ marginTop: spacing.xl }}>
          <LoadingSkeleton lines={2} />
        </View>
      ) : (
        <View
          style={{
            flexDirection: 'row',
            alignSelf: 'stretch',
            marginTop: spacing.xl,
          }}
        >
          <StatCard label="Trips" value={stats.tripsCount} width={statWidth} style={{ marginRight: statGap }} />
          <StatCard
            label="Countries"
            value={stats.countriesCount}
            accent={brand.accent}
            width={statWidth}
            style={{ marginRight: statGap }}
          />
          <StatCard label="AI plans" value={stats.aiPlansCount} accent={brand.ai} width={statWidth} />
        </View>
      )}

      {/* Account menu */}
      <View style={{ marginTop: spacing['2xl'] }}>
        <Text
          style={{
            ...typography.h1,
            fontSize: scaleFont(24),
            color: theme.colors.text,
            letterSpacing: -0.5,
            marginBottom: spacing.lg,
          }}
        >
          Account
        </Text>
        <MenuRow
          label="Edit profile"
          description="Update your name and photo"
          icon={UserPen}
          gapAfter={spacing.xl}
          onPress={() => router.push('/edit-profile')}
        />
        <MenuRow
          label="Settings"
          description="Theme, notifications & offline sync"
          icon={Settings}
          iconColor={brand.ai}
          iconBg={theme.colors.aiMuted}
          gapAfter={spacing.xl}
          onPress={() => router.push('/settings')}
        />
        <MenuRow
          label={signOutMutation.isPending ? 'Signing out…' : 'Sign out'}
          icon={LogOut}
          destructive
          showChevron={false}
          gapAfter={0}
          onPress={handleSignOut}
        />
      </View>
    </ScreenWrapper>
  )
}
