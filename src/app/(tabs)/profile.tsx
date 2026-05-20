import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { ChevronRight, LogOut, Settings } from 'lucide-react-native'

import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import ScreenWrapper from '@/components/ui/ScreenWrapper'
import { mockUser } from '@/constants/design'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import { useAuth } from '@/providers/auth-provider'
import { signOut } from '@/services/auth.service'

export default function ProfileScreen() {
  const router = useRouter()
  const theme = useThemedStyles()
  const { user, displayName } = useAuth()

  const email = user?.email ?? mockUser.email
  const name = user ? displayName : mockUser.name

  const handleSignOut = async () => {
    await signOut()
    router.replace('/(auth)/login')
  }

  const menuItems = [
    { label: 'Settings', icon: Settings, route: '/settings' as const },
    { label: 'Sign out', icon: LogOut, action: handleSignOut },
  ]

  return (
    <ScreenWrapper scroll>
      <View className="items-center mt-6">
        <Avatar uri={mockUser.avatar} name={name} size="lg" />
        <Text className={`${theme.text} text-2xl font-bold mt-4`}>{name}</Text>
        <Text className={`${theme.textMuted} mt-1`}>{email}</Text>
      </View>

      <View className="flex-row gap-3 mt-8">
        <Card className="flex-1 items-center">
          <Text className={`${theme.text} text-2xl font-bold`}>{mockUser.tripsCount}</Text>
          <Text className={`${theme.textMuted} text-xs mt-1`}>Trips</Text>
        </Card>
        <Card className="flex-1 items-center">
          <Text className={`${theme.text} text-2xl font-bold`}>{mockUser.countriesVisited}</Text>
          <Text className={`${theme.textMuted} text-xs mt-1`}>Countries</Text>
        </Card>
        <Card className="flex-1 items-center">
          <Text className={`${theme.text} text-2xl font-bold`}>{mockUser.aiPlansGenerated}</Text>
          <Text className={`${theme.textMuted} text-xs mt-1`}>AI plans</Text>
        </Card>
      </View>

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
