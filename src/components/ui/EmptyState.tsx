import { Text, View } from 'react-native'
import type { LucideIcon } from 'lucide-react-native'

import { brand } from '@/constants/design'
import { cardShadow, isWeb, radii } from '@/lib/ui-styles'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import { Button } from './Button'

interface Props {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: Props) {
  const theme = useThemedStyles()

  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: isWeb ? 64 : 48,
        paddingHorizontal: 24,
      }}
    >
      <View
        style={[
          {
            width: 88,
            height: 88,
            borderRadius: 44,
            backgroundColor: theme.colors.muted,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
          },
          cardShadow(theme.isDark, false),
        ]}
      >
        <Icon size={40} color={brand.primaryDark} strokeWidth={1.75} />
      </View>
      <Text
        style={{
          color: theme.colors.text,
          fontSize: isWeb ? 24 : 20,
          fontWeight: '700',
          textAlign: 'center',
          letterSpacing: -0.3,
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          color: theme.colors.textMuted,
          textAlign: 'center',
          marginTop: 10,
          lineHeight: 24,
          fontSize: 15,
          maxWidth: 320,
        }}
      >
        {description}
      </Text>
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} style={{ marginTop: 32, maxWidth: 280 }} />
      ) : null}
    </View>
  )
}

export default EmptyState
