import { Text, View } from 'react-native'

import { brand } from '@/constants/design'
import { isWeb } from '@/lib/ui-styles'
import { useThemedStyles } from '@/hooks/use-themed-styles'

interface Props {
  title: string
  subtitle?: string
}

export default function SectionTitle({ title, subtitle }: Props) {
  const theme = useThemedStyles()

  return (
    <View style={{ marginTop: isWeb ? 36 : 28, marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View
          style={{
            width: 4,
            height: 24,
            borderRadius: 2,
            backgroundColor: brand.primary,
          }}
        />
        <Text
          style={{
            color: theme.colors.text,
            fontSize: isWeb ? 22 : 20,
            fontWeight: '700',
            letterSpacing: -0.3,
          }}
        >
          {title}
        </Text>
      </View>
      {subtitle ? (
        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: 14,
            marginTop: 6,
            marginLeft: 14,
          }}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  )
}
