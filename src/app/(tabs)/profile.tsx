import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { ChevronRight, LogOut, Settings } from 'lucide-react-native'

import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import ScreenWrapper from '@/components/ui/ScreenWrapper'
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
    { label: 'Sign out', icon: LogOut, action: handleSignOut },
  ]

  return (
    <ScreenWrapper scroll>
      <View className="items-center mt-6">
        <Avatar uri={profile?.avatar_url ?? undefined} name={name} size="lg" />
        <Text className={`${theme.text} text-2xl font-bold mt-4`}>{name}</Text>
        <Text className={`${theme.textMuted} mt-1`}>{email}</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator className="mt-8" color="#0EA5E9" />
      ) : (
        <View className="flex-row gap-3 mt-8">
          <View className={`flex-1 items-center rounded-2xl p-4 ${theme.bgCard} border ${theme.border}`}>
            <Text className={`${theme.text} text-2xl font-bold`}>
              {profile?.trips_count ?? 0}
            </Text>
            <Text className={`${theme.textMuted} text-xs mt-1`}>Trips</Text>
          </View>
          <View className={`flex-1 items-center rounded-2xl p-4 ${theme.bgCard} border ${theme.border}`}>
            <Text className={`${theme.text} text-2xl font-bold`}>
              {profile?.countries_visited ?? 0}
            </Text>
            <Text className={`${theme.textMuted} text-xs mt-1`}>Countries</Text>
          </View>
          <View className={`flex-1 items-center rounded-2xl p-4 ${theme.bgCard} border ${theme.border}`}>
            <Text className={`${theme.text} text-2xl font-bold`}>
              {profile?.ai_plans_generated ?? 0}
            </Text>
            <Text className={`${theme.textMuted} text-xs mt-1`}>AI plans</Text>
          </View>
        </View>
      )}

      <View className="mt-6">
        {menuItems.map((item) => {
          const Icon = item.icon
          return (
            <Pressable
              key={item.label}
              onPress={'action' in item ? item.action : () => router.push(item.route)}
              className={`${theme.bgCard} ${theme.border} border rounded-2xl p-4 mb-3 flex-row items-center active:opacity-90`}
            >
              <Icon size={22} color={theme.isDark ? '#94A3B8' : '#64748B'} />
              <Text className={`${theme.text} flex-1 ml-3 font-medium`}>{item.label}</Text>
              <ChevronRight size={20} color={theme.isDark ? '#64748B' : '#94A3B8'} />
            </Pressable>
          )
        })}
      </View>

      <Button title="Edit profile" variant="outline" className="mt-2" />
    </ScreenWrapper>
  )
}
