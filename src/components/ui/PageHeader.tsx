import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { ChevronLeft } from 'lucide-react-native'

import { spacing } from '@/constants/design'
import { typography } from '@/constants/typography'
import { useResponsive } from '@/hooks/use-responsive'
import { radii } from '@/lib/ui-styles'
import { useThemedStyles } from '@/hooks/use-themed-styles'

interface Props {
  title: string
  subtitle?: string
  eyebrow?: string
  showBack?: boolean
  rightElement?: ReactNode
  large?: boolean
}

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  showBack,
  rightElement,
  large = false,
}: Props) {
  const router = useRouter()
  const theme = useThemedStyles()
  const { scaleFont } = useResponsive()

  const handleBack = () => {
    if (router.canGoBack()) router.back()
    else router.replace('/(tabs)/index')
  }

  return (
    <View style={{ marginBottom: spacing.xl, paddingTop: spacing.xs }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: spacing.md,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
          {showBack ? (
            <Pressable
              onPress={handleBack}
              hitSlop={8}
              style={{
                width: 40,
                height: 40,
                borderRadius: radii.pill,
                backgroundColor: theme.colors.card,
                borderWidth: 1,
                borderColor: theme.colors.border,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: spacing.md,
                flexShrink: 0,
              }}
            >
              <ChevronLeft size={22} color={theme.colors.text} />
            </Pressable>
          ) : null}
          <View style={{ flex: 1, minWidth: 0 }}>
            {eyebrow ? (
              <Text style={{ ...typography.eyebrow, color: theme.colors.textMuted, marginBottom: spacing.xs }}>
                {eyebrow}
              </Text>
            ) : null}
            <Text
              style={{
                ...(large ? typography.display : typography.h1),
                fontSize: scaleFont(large ? 28 : 24),
                color: theme.colors.text,
                letterSpacing: large ? -0.8 : -0.5,
              }}
              numberOfLines={2}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text
                style={{
                  ...typography.bodySm,
                  color: theme.colors.textMuted,
                  marginTop: spacing.sm,
                  lineHeight: 20,
                }}
                numberOfLines={3}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
        {rightElement ? <View style={{ flexShrink: 0 }}>{rightElement}</View> : null}
      </View>
    </View>
  )
}

export default PageHeader
