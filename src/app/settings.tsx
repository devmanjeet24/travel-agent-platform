import { useEffect, useState } from 'react'
import { LayoutAnimation, Platform, Pressable, Switch, Text, UIManager, View } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { Bell, Cloud, Palette } from 'lucide-react-native'

import { RequireSession } from '@/components/auth/require-session'
import { PageHeader } from '@/components/ui/PageHeader'
import ScreenWrapper from '@/components/ui/ScreenWrapper'
import { profileKeys, useProfileQuery } from '@/hooks/profile/use-profile-query'
import { applyOfflineSyncPreference } from '@/lib/offline-sync'
import { useAuth } from '@/providers/auth-provider'
import { brand, spacing } from '@/constants/design'
import { textWithWeight } from '@/constants/inter-typography'
import { typography } from '@/constants/typography'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import { useThemePreference, type ThemePreference } from '@/providers/theme-preference-provider'
import { updateProfileSettings } from '@/services/profile/profile-api'
import {
  disablePushNotificationsForUser,
  enablePushNotificationsForUser,
} from '@/services/push/push-registration-service'
import { cardShadow, radii } from '@/lib/ui-styles'

function SettingsSection({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: typeof Palette
  children: React.ReactNode
}) {
  const theme = useThemedStyles()

  return (
    <View style={{ marginBottom: spacing['2xl'] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
        <Icon size={18} color={brand.primary} />
        <Text style={{ ...typography.h3, color: theme.colors.text }}>{title}</Text>
      </View>
      <View
        style={[
          {
            borderRadius: radii['2xl'],
            padding: spacing.lg,
            backgroundColor: theme.colors.card,
            borderWidth: 1,
            borderColor: theme.colors.border,
          },
          cardShadow(theme.isDark, false),
        ]}
      >
        {children}
      </View>
    </View>
  )
}

function SettingToggle({
  label,
  description,
  value,
  onValueChange,
}: {
  label: string
  description?: string
  value: boolean
  onValueChange: (v: boolean) => void
}) {
  const theme = useThemedStyles()

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.sm,
      }}
    >
      <View style={{ flex: 1, paddingRight: spacing.md, minWidth: 0 }}>
        <Text style={{ ...typography.h3, color: theme.colors.text, fontSize: 15 }}>{label}</Text>
        {description ? (
          <Text
            style={{
              ...typography.caption,
              color: theme.colors.textMuted,
              marginTop: 2,
              lineHeight: 16,
            }}
          >
            {description}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.colors.border, true: brand.primary }}
        thumbColor="#FFFFFF"
      />
    </View>
  )
}

function ThemeModeSelector() {
  const theme = useThemedStyles()
  const { preference, colorScheme, setPreference } = useThemePreference()
  const options: { label: string; value: ThemePreference }[] = [
    { label: 'Light', value: 'light' },
    { label: 'Dark', value: 'dark' },
    { label: 'System', value: 'system' },
  ]

  const onSelect = (next: ThemePreference) => {
    if (next === preference) return
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    void setPreference(next)
  }

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: theme.colors.muted,
          borderRadius: radii.pill,
          padding: 4,
          borderWidth: 1,
          borderColor: theme.colors.border,
        }}
      >
        {options.map((option) => {
          const selected = preference === option.value
          return (
            <Pressable
              key={option.value}
              onPress={() => onSelect(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={{
                flex: 1,
                borderRadius: radii.pill,
                paddingVertical: spacing.sm + 2,
                alignItems: 'center',
                backgroundColor: selected ? theme.colors.card : 'transparent',
                borderWidth: selected ? 1 : 0,
                borderColor: selected ? theme.colors.border : 'transparent',
              }}
            >
              <Text
                style={textWithWeight(typography.label, selected ? '700' : '600', {
                  color: selected ? brand.primary : theme.colors.textMuted,
                  fontSize: 13,
                })}
              >
                {option.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
      <Text style={{ ...typography.caption, color: theme.colors.textMuted, marginTop: spacing.sm }}>
        {preference === 'system'
          ? `Follows device setting (${colorScheme === 'dark' ? 'Dark' : 'Light'})`
          : 'Applies instantly across the app'}
      </Text>
    </View>
  )
}

export default function SettingsScreen() {
  const theme = useThemedStyles()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data: profile } = useProfileQuery()
  const [notificationsDraft, setNotificationsDraft] = useState<boolean | null>(null)
  const [offlineModeDraft, setOfflineModeDraft] = useState<boolean | null>(null)
  const notifications =
    notificationsDraft ?? profile?.push_notifications_enabled ?? true
  const offlineMode = offlineModeDraft ?? profile?.offline_sync_enabled ?? true

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true)
    }
  }, [])

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
    if (!user) return
    setNotificationsDraft(value)
    try {
      await persist({ push_notifications_enabled: value })
      if (value) {
        await enablePushNotificationsForUser(user.id)
      } else {
        await disablePushNotificationsForUser(user.id)
      }
      void queryClient.invalidateQueries({ queryKey: profileKeys.detail(user.id) })
    } catch (e) {
      setNotificationsDraft(null)
      console.warn('[settings] push toggle failed:', e)
    }
  }

  const onOfflineChange = async (value: boolean) => {
    setOfflineModeDraft(value)
    try {
      await persist({ offline_sync_enabled: value })
      await applyOfflineSyncPreference(value, user?.id)
      if (user) {
        void queryClient.invalidateQueries({ queryKey: profileKeys.detail(user.id) })
      }
    } catch (e) {
      setOfflineModeDraft(null)
      console.warn('[settings] offline toggle failed:', e)
    }
  }

  return (
    <RequireSession>
      <ScreenWrapper scroll keyboardAvoiding scrollFlexGrow={false} subtleBackground>
        <PageHeader
          showBack
          title="Settings"
          subtitle="Preferences for your account and this device"
        />

        <SettingsSection title="Appearance" icon={Palette}>
          <ThemeModeSelector />
        </SettingsSection>

        <SettingsSection title="Notifications" icon={Bell}>
          <SettingToggle
            label="Push notifications"
            description="Trip reminders and travel updates"
            value={notifications}
            onValueChange={onNotificationsChange}
          />
        </SettingsSection>

        <SettingsSection title="Data & sync" icon={Cloud}>
          <SettingToggle
            label="Offline trip sync"
            description="Cache trips and chat for use without network"
            value={offlineMode}
            onValueChange={onOfflineChange}
          />
        </SettingsSection>

        <View
          style={[
            {
              borderRadius: radii.xl,
              padding: spacing.lg,
              backgroundColor: theme.colors.card,
              borderWidth: 1,
              borderColor: theme.colors.border,
            },
            cardShadow(theme.isDark, false),
          ]}
        >
          <Text style={{ ...typography.caption, color: theme.colors.textMuted }}>Version</Text>
          <Text style={{ ...typography.bodySm, color: theme.colors.text, marginTop: spacing.xs }}>
            1.1.0 · Live APIs + Supabase
          </Text>
        </View>
      </ScreenWrapper>
    </RequireSession>
  )
}
