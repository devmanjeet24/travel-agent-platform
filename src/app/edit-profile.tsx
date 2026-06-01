import { useState } from 'react'
import { Alert, Platform, Text, View } from 'react-native'
import { useRouter } from 'expo-router'

import { RequireSession } from '@/components/auth/require-session'
import { ProfileAvatarEditor } from '@/components/profile/ProfileAvatarEditor'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import ScreenWrapper from '@/components/ui/ScreenWrapper'
import { Card } from '@/components/ui/Card'
import { spacing } from '@/constants/design'
import { typography } from '@/constants/typography'
import { useProfileQuery } from '@/hooks/profile/use-profile-query'
import { useUpdateProfileMutation } from '@/hooks/profile/use-update-profile-mutation'
import { useAuth } from '@/providers/auth-provider'
import { useThemedStyles } from '@/hooks/use-themed-styles'

function showMessage(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`)
  } else {
    Alert.alert(title, message)
  }
}

export default function EditProfileScreen() {
  const router = useRouter()
  const theme = useThemedStyles()
  const { user, displayName } = useAuth()
  const { data: profile, isLoading } = useProfileQuery()
  const updateMutation = useUpdateProfileMutation()
  const handleBackPress = () => {
    if (router.canGoBack()) router.back()
    else router.replace('/(tabs)/profile')
  }

  const initialDisplayName =
    profile?.display_name ?? (!isLoading ? (displayName === 'Traveler' ? '' : displayName) : '')
  const [displayNameDraft, setDisplayNameDraft] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string | undefined>()

  const email = user?.email ?? ''
  const displayNameInput = displayNameDraft ?? initialDisplayName
  const avatarName = displayNameInput.trim() || displayName

  const handleSave = () => {
    const trimmed = displayNameInput.trim()
    if (!trimmed) {
      setFieldError('Display name is required')
      return
    }
    setFieldError(undefined)

    updateMutation.mutate(
      { display_name: trimmed },
      {
        onSuccess: () => {
          showMessage('Profile', 'Your changes were saved.')
          handleBackPress()
        },
        onError: (err) => {
          const message = err instanceof Error ? err.message : 'Could not save profile'
          setFieldError(message)
          showMessage('Profile', message)
        },
      },
    )
  }

  return (
    <RequireSession>
      <ScreenWrapper scroll keyboardAvoiding subtleBackground>
        <PageHeader showBack title="Edit profile" subtitle="Update your name and photo" />

        <View
          style={{
            alignItems: 'center',
            marginBottom: spacing['2xl'],
            paddingVertical: spacing.xl,
          }}
        >
          <ProfileAvatarEditor
            uri={profile?.avatar_url ?? undefined}
            name={avatarName}
            size="lg"
          />
          <Text style={{ ...typography.caption, color: theme.colors.textMuted, marginTop: spacing.md }}>
            Tap photo to change
          </Text>
        </View>

        <Input
          label="Display name"
          value={displayNameInput}
          onChangeText={(text) => {
            setDisplayNameDraft(text)
            if (fieldError) setFieldError(undefined)
          }}
          placeholder="Your name"
          autoCapitalize="words"
          autoCorrect={false}
          editable={!updateMutation.isPending}
          error={fieldError}
        />

        <Card style={{ marginBottom: spacing.xl }}>
          <Text style={{ ...typography.eyebrow, color: theme.colors.textMuted }}>Email</Text>
          <Text style={{ ...typography.body, color: theme.colors.text, marginTop: spacing.sm }}>{email}</Text>
          <Text style={{ ...typography.caption, color: theme.colors.textMuted, marginTop: spacing.sm, lineHeight: 18 }}>
            Email is managed by your sign-in provider and cannot be changed here.
          </Text>
        </Card>

        <Button
          title={updateMutation.isPending ? 'Saving…' : 'Save changes'}
          onPress={handleSave}
          disabled={updateMutation.isPending || isLoading}
        />

        <Button
          title="Cancel"
          variant="ghost"
          onPress={handleBackPress}
          disabled={updateMutation.isPending}
          style={{ marginTop: 10 }}
        />
      </ScreenWrapper>
    </RequireSession>
  )
}
