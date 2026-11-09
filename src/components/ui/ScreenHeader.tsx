import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { ChevronLeft } from 'lucide-react-native'

import { brand, layout, spacing } from '@/constants/design'
import { typography } from '@/constants/typography'
import { radii } from '@/lib/ui-styles'
import { useThemedStyles } from '@/hooks/use-themed-styles'

interface Props {
  title: string
  subtitle?: string
  eyebrow?: string
  showBack?: boolean
  rightElement?: React.ReactNode
}

export function ScreenHeader({ title, subtitle, eyebrow, showBack, rightElement }: Props) {
  const router = useRouter()
  const theme = useThemedStyles()
  const handleBackPress = () => {
    if (router.canGoBack()) router.back()
    else router.replace('/(tabs)')
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 28,
        paddingTop: spacing.xs,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', flex: 1 }}>
        {showBack ? (
          <Pressable
            onPress={handleBackPress}
            style={{
              width: layout.touchTarget,
              height: layout.touchTarget,
              borderRadius: radii.pill,
              backgroundColor: theme.colors.card,
              borderWidth: 1,
              borderColor: theme.colors.border,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: spacing.md,
            }}
            hitSlop={8}
          >
            <ChevronLeft size={22} color={theme.colors.text} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }}>
          {eyebrow ? (
            <Text
              style={{
                ...typography.eyebrow,
                color: brand.primaryDark,
                marginBottom: spacing.sm,
              }}
            >
              {eyebrow}
            </Text>
          ) : null}
          <Text style={{ ...typography.h1, color: theme.colors.text }}>{title}</Text>
          {subtitle ? (
            <Text
              style={{
                ...typography.bodySm,
                color: theme.colors.textMuted,
                marginTop: spacing.sm,
                maxWidth: 520,
                lineHeight: 22,
              }}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      {rightElement}
    </View>
  )
}

export default ScreenHeader
