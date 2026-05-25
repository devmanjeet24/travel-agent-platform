import { useState } from 'react'
import { Switch, Text, useColorScheme } from 'react-native'

import { RequireSession } from '@/components/auth/require-session'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import ScreenWrapper from '@/components/ui/ScreenWrapper'
import { Card } from '@/components/ui/Card'
import { useProfileQuery } from '@/hooks/profile/use-profile-query'
import { updateProfileSettings } from '@/services/profile/profile-api'
import { registerForPushNotifications } from '@/lib/notifications-setup'
import { useAuth } from '@/providers/auth-provider'
import { brand } from '@/constants/design'
import { useThemedStyles } from '@/hooks/use-themed-styles'

export default function SettingsScreen() {
  const theme = useThemedStyles()
  const systemScheme = useColorScheme()
  const { user } = useAuth()
  const { data: profile } = useProfileQuery()
  const [notificationsDraft, setNotificationsDraft] = useState<boolean | null>(null)
  const [offlineModeDraft, setOfflineModeDraft] = useState<boolean | null>(null)
  const notifications =
    notificationsDraft ?? profile?.push_notifications_enabled ?? true
  const offlineMode = offlineModeDraft ?? profile?.offline_sync_enabled ?? true

  const persist = async (
    patch: Partial<{
      push_notifications_enabled: boolean
      offline_sync_enabled: boolean
    }>,
  ) => {
    if (!user) return
    await updateProfileSettings(user.id, patch)
  }

  const onNotificationsChange = async (value: boolean) => {
    setNotificationsDraft(value)
    await persist({ push_notifications_enabled: value })
    if (value) await registerForPushNotifications()
  }

  const onOfflineChange = async (value: boolean) => {
    setOfflineModeDraft(value)
    await persist({ offline_sync_enabled: value })
  }

  return (
    <RequireSession>
      <ScreenWrapper scroll keyboardAvoiding>
        <ScreenHeader eyebrow="Account" title="Settings" subtitle="Preferences & app" showBack />

        <Card className="mb-4">
          <Text className={`${theme.textMuted} text-sm`}>Appearance</Text>
          <Text className={`${theme.text} font-medium mt-1`}>
            System · {systemScheme === 'dark' ? 'Dark' : 'Light'} mode
          </Text>
        </Card>

        <Card className="mb-3 flex-row items-center justify-between">
          <Text className={`${theme.text} font-medium flex-1`}>Push notifications</Text>
          <Switch
            value={notifications}
            onValueChange={onNotificationsChange}
            trackColor={{ true: brand.primaryDark }}
          />
        </Card>

        <Card className="mb-3 flex-row items-center justify-between">
          <Text className={`${theme.text} font-medium flex-1`}>Offline trip sync</Text>
          <Switch
            value={offlineMode}
            onValueChange={onOfflineChange}
            trackColor={{ true: brand.primaryDark }}
          />
        </Card>

        <Card className="mt-4">
          <Text className={`${theme.textMuted} text-sm`}>Version</Text>
          <Text className={`${theme.text} mt-1`}>1.1.0 · Live APIs + Supabase</Text>
        </Card>
      </ScreenWrapper>
    </RequireSession>
  )
}
