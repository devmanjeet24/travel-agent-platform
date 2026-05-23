import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { ChevronLeft } from 'lucide-react-native'

import { brand } from '@/constants/design'
import { isWeb, radii } from '@/lib/ui-styles'
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

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: isWeb ? 28 : 20,
        paddingTop: 4,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', flex: 1 }}>
        {showBack ? (
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 44,
              height: 44,
              borderRadius: radii.md,
              backgroundColor: theme.colors.muted,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 14,
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
                color: brand.primaryDark,
                fontSize: 12,
                fontWeight: '700',
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              {eyebrow}
            </Text>
          ) : null}
          <Text
            style={{
              color: theme.colors.text,
              fontSize: isWeb ? 32 : 26,
              fontWeight: '700',
              letterSpacing: -0.5,
            }}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={{
                color: theme.colors.textMuted,
                fontSize: 15,
                lineHeight: 22,
                marginTop: 6,
                maxWidth: isWeb ? 520 : undefined,
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
