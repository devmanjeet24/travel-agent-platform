import { useState } from 'react'
import { Alert, Platform, Text, View } from 'react-native'
import { useRouter } from 'expo-router'

import { RequireSession } from '@/components/auth/require-session'
import { ProfileAvatarEditor } from '@/components/profile/ProfileAvatarEditor'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import ScreenWrapper from '@/components/ui/ScreenWrapper'
import { Card } from '@/components/ui/Card'
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
          router.back()
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
      <ScreenWrapper scroll keyboardAvoiding>
        <ScreenHeader
          eyebrow="Account"
          title="Edit profile"
          subtitle="Name and photo"
          showBack
        />

        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <ProfileAvatarEditor
            uri={profile?.avatar_url ?? undefined}
            name={avatarName}
            size="lg"
          />
          <Text style={{ color: theme.colors.textMuted, fontSize: 13, marginTop: 12 }}>
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

        <Card style={{ marginBottom: 24 }}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 13, fontWeight: '600', letterSpacing: 0.3, textTransform: 'uppercase' }}>
            Email
          </Text>
          <Text style={{ color: theme.colors.text, fontSize: 16, marginTop: 8 }}>{email}</Text>
          <Text style={{ color: theme.colors.textMuted, fontSize: 13, marginTop: 6 }}>
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
          onPress={() => router.back()}
          disabled={updateMutation.isPending}
          style={{ marginTop: 10 }}
        />
      </ScreenWrapper>
    </RequireSession>
  )
}
