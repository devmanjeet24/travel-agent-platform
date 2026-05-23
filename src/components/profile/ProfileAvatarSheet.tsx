import { Modal, Platform, Pressable, Text, View } from 'react-native'

import { brand } from '@/constants/design'
import { radii } from '@/lib/ui-styles'
import { useThemedStyles } from '@/hooks/use-themed-styles'

type Props = {
  visible: boolean
  hasPhoto: boolean
  busy: boolean
  onClose: () => void
  onChoosePhoto: () => void
  onTakePhoto: () => void
  onRemovePhoto: () => void
}

export function ProfileAvatarSheet({
  visible,
  hasPhoto,
  busy,
  onClose,
  onChoosePhoto,
  onTakePhoto,
  onRemovePhoto,
}: Props) {
  const theme = useThemedStyles()

  const actions: {
    label: string
    onPress: () => void
    destructive?: boolean
  }[] = [
    { label: 'Choose Photo', onPress: onChoosePhoto },
    ...(Platform.OS !== 'web' ? [{ label: 'Take Photo', onPress: onTakePhoto }] : []),
    ...(hasPhoto ? [{ label: 'Remove Photo', onPress: onRemovePhoto, destructive: true }] : []),
  ]

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.45)',
          justifyContent: 'flex-end',
        }}
        onPress={busy ? undefined : onClose}
      >
        <Pressable
          style={{
            marginHorizontal: 12,
            marginBottom: 24,
            borderRadius: radii.lg,
            backgroundColor: theme.colors.card,
            overflow: 'hidden',
          }}
          onPress={(e) => e.stopPropagation()}
        >
          {actions.map((action, index) => (
            <Pressable
              key={action.label}
              disabled={busy}
              onPress={action.onPress}
              style={{
                paddingVertical: 16,
                alignItems: 'center',
                borderTopWidth: index > 0 ? 1 : 0,
                borderTopColor: theme.colors.border,
                opacity: busy ? 0.5 : 1,
              }}
            >
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: '600',
                  color: action.destructive ? brand.danger : brand.primaryDark,
                }}
              >
                {action.label}
              </Text>
            </Pressable>
          ))}
          <Pressable
            disabled={busy}
            onPress={onClose}
            style={{
              paddingVertical: 16,
              alignItems: 'center',
              borderTopWidth: 1,
              borderTopColor: theme.colors.border,
              backgroundColor: theme.colors.background,
              opacity: busy ? 0.5 : 1,
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: '600', color: theme.colors.textMuted }}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
