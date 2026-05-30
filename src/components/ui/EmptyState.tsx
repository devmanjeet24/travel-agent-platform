import { Text, View } from 'react-native'
import type { LucideIcon } from 'lucide-react-native'

import { brand, spacing } from '@/constants/design'
import { typography } from '@/constants/typography'
import { cardShadow, radii } from '@/lib/ui-styles'
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
        paddingVertical: 64,
        paddingHorizontal: spacing['2xl'],
      }}
    >
      <View
        style={[
          {
            width: 80,
            height: 80,
            borderRadius: radii.xl,
            backgroundColor: theme.colors.aiMuted,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing['2xl'],
            borderWidth: 1,
            borderColor: theme.colors.border,
          },
          cardShadow(theme.isDark, false),
        ]}
      >
        <Icon size={36} color={brand.ai} strokeWidth={1.75} />
      </View>
      <Text
        style={{
          ...typography.h2,
          color: theme.colors.text,
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          ...typography.bodySm,
          color: theme.colors.textMuted,
          textAlign: 'center',
          marginTop: spacing.sm,
          maxWidth: 300,
          lineHeight: 22,
        }}
      >
        {description}
      </Text>
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} style={{ marginTop: spacing['3xl'], maxWidth: 280 }} />
      ) : null}
    </View>
  )
}

export default EmptyState
