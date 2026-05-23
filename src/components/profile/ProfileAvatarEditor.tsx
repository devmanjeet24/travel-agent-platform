import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native'

import { Avatar } from '@/components/ui/Avatar'
import { ProfileAvatarCropModal } from '@/components/profile/ProfileAvatarCropModal'
import { ProfileAvatarSheet } from '@/components/profile/ProfileAvatarSheet'
import { brand } from '@/constants/design'
import { useProfileAvatar } from '@/hooks/profile/use-profile-avatar'

type Props = {
  uri?: string
  name?: string
  size?: 'sm' | 'md' | 'lg'
}

export function ProfileAvatarEditor({ uri, name, size = 'lg' }: Props) {
  const avatar = useProfileAvatar(uri)
  const displayUri = avatar.displayAvatarUrl ?? undefined

  return (
    <>
      <Pressable
        onPress={avatar.openSheet}
        disabled={avatar.isUpdating}
        accessibilityRole="button"
        accessibilityLabel="Change profile photo"
        style={{ position: 'relative' }}
      >
        <Avatar uri={displayUri} name={name} size={size} />
        {avatar.isUpdating ? (
          <View
            style={{
              ...StyleSheet.absoluteFillObject,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 999,
              backgroundColor: 'rgba(0,0,0,0.35)',
            }}
            pointerEvents="none"
          >
            <ActivityIndicator color={brand.onPrimary} size="large" />
          </View>
        ) : null}
      </Pressable>

      <ProfileAvatarSheet
        visible={avatar.sheetVisible}
        hasPhoto={avatar.hasPhoto}
        busy={avatar.isUpdating}
        onClose={avatar.closeSheet}
        onChoosePhoto={() => void avatar.pickFromLibrary()}
        onTakePhoto={() => void avatar.takePhoto()}
        onRemovePhoto={() => void avatar.removePhoto()}
      />

      <ProfileAvatarCropModal
        visible={avatar.cropVisible}
        imageUri={avatar.cropImageUri}
        busy={avatar.isUpdating}
        onCancel={avatar.cancelCrop}
        onConfirm={() => void avatar.confirmCrop()}
      />
    </>
  )
}
