import { ActivityIndicator, Image, Modal, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Check, X } from 'lucide-react-native'

import { brand } from '@/constants/design'
import { radii } from '@/lib/ui-styles'
import { useThemedStyles } from '@/hooks/use-themed-styles'

type Props = {
  visible: boolean
  imageUri: string | null
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}

const PREVIEW_SIZE = 300

export function ProfileAvatarCropModal({
  visible,
  imageUri,
  busy,
  onCancel,
  onConfirm,
}: Props) {
  const theme = useThemedStyles()
  const insets = useSafeAreaInsets()

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={busy ? undefined : onCancel}
    >
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: insets.top + 8,
            paddingHorizontal: 12,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
          }}
        >
          <Pressable
            onPress={onCancel}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingVertical: 8,
              paddingHorizontal: 4,
              opacity: busy ? 0.5 : 1,
              minWidth: 88,
            }}
          >
            <X size={22} color={theme.colors.text} />
            <Text style={{ color: theme.colors.text, fontSize: 17, fontWeight: '600' }}>Cancel</Text>
          </Pressable>

          <Text style={{ color: theme.colors.text, fontSize: 17, fontWeight: '700' }}>Edit photo</Text>

          <Pressable
            onPress={onConfirm}
            disabled={busy || !imageUri}
            accessibilityRole="button"
            accessibilityLabel="Save profile photo"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingVertical: 8,
              paddingHorizontal: 4,
              opacity: busy || !imageUri ? 0.5 : 1,
              minWidth: 88,
              justifyContent: 'flex-end',
            }}
          >
            {busy ? (
              <ActivityIndicator size="small" color={brand.primaryDark} />
            ) : (
              <Check size={22} color={brand.primaryDark} strokeWidth={2.5} />
            )}
            <Text style={{ color: brand.primaryDark, fontSize: 17, fontWeight: '700' }}>Save</Text>
          </Pressable>
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <Text
            style={{
              color: theme.colors.textMuted,
              fontSize: 14,
              textAlign: 'center',
              marginBottom: 20,
            }}
          >
            Your photo will be cropped to a square for your profile.
          </Text>

          <View
            style={{
              width: PREVIEW_SIZE,
              height: PREVIEW_SIZE,
              borderRadius: PREVIEW_SIZE / 2,
              overflow: 'hidden',
              backgroundColor: theme.colors.muted,
              borderWidth: 3,
              borderColor: brand.primaryDark,
            }}
          >
            {imageUri ? (
              <Image
                source={{ uri: imageUri }}
                style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE }}
                resizeMode="cover"
              />
            ) : null}
          </View>
        </View>

        <View
          style={{
            paddingHorizontal: 20,
            paddingBottom: insets.bottom + 16,
            paddingTop: 12,
            gap: 10,
          }}
        >
          <Pressable
            onPress={onConfirm}
            disabled={busy || !imageUri}
            style={{
              backgroundColor: brand.primaryDark,
              borderRadius: radii.lg,
              paddingVertical: 16,
              alignItems: 'center',
              opacity: busy || !imageUri ? 0.5 : 1,
            }}
          >
            {busy ? (
              <ActivityIndicator color={brand.onPrimary} />
            ) : (
              <Text style={{ color: brand.onPrimary, fontSize: 17, fontWeight: '700' }}>Use this photo</Text>
            )}
          </Pressable>

          <Pressable
            onPress={onCancel}
            disabled={busy}
            style={{
              borderRadius: radii.lg,
              paddingVertical: 16,
              alignItems: 'center',
              borderWidth: 1.5,
              borderColor: theme.colors.border,
              opacity: busy ? 0.5 : 1,
            }}
          >
            <Text style={{ color: theme.colors.text, fontSize: 17, fontWeight: '600' }}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}
