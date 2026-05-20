import { useState } from 'react'
import { Switch, Text, useColorScheme } from 'react-native'

import { RequireSession } from '@/components/auth/require-session'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import ScreenWrapper from '@/components/ui/ScreenWrapper'
import { Card } from '@/components/ui/Card'
import { useThemedStyles } from '@/hooks/use-themed-styles'

export default function SettingsScreen() {
  const theme = useThemedStyles()
  const systemScheme = useColorScheme()
  const [notifications, setNotifications] = useState(true)
  const [offlineMode, setOfflineMode] = useState(true)

  const settings = [
    {
      label: 'Push notifications',
      value: notifications,
      onChange: setNotifications,
    },
    {
      label: 'Offline trip sync',
      value: offlineMode,
      onChange: setOfflineMode,
    },
  ]

  return (
    <RequireSession>
    <ScreenWrapper scroll>
      <ScreenHeader title="Settings" subtitle="Preferences & app" showBack />

      <Card className="mb-4">
        <Text className={`${theme.textMuted} text-sm`}>Appearance</Text>
        <Text className={`${theme.text} font-medium mt-1`}>
          System · {systemScheme === 'dark' ? 'Dark' : 'Light'} mode
        </Text>
        <Text className={`${theme.textMuted} text-xs mt-2`}>
          Follows device setting (assignment: dark/light support)
        </Text>
      </Card>

      {settings.map((s) => (
        <Card key={s.label} className="mb-3 flex-row items-center justify-between">
          <Text className={`${theme.text} font-medium flex-1`}>{s.label}</Text>
          <Switch value={s.value} onValueChange={s.onChange} trackColor={{ true: '#0EA5E9' }} />
        </Card>
      ))}

      <Card className="mt-4">
        <Text className={`${theme.textMuted} text-sm`}>Version</Text>
        <Text className={`${theme.text} mt-1`}>1.0.0 · Design preview</Text>
      </Card>
    </ScreenWrapper>
    </RequireSession>
  )
}
