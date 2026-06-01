import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { getHeaderTitle } from '@react-navigation/elements'
import type { NativeStackHeaderProps } from '@react-navigation/native-stack'
import { ChevronLeft } from 'lucide-react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { spacing } from '@/constants/design'
import { typography } from '@/constants/typography'
import { radii } from '@/lib/ui-styles'
import { useThemedStyles } from '@/hooks/use-themed-styles'

/**
 * Stack header for trip detail screens. Uses SafeAreaView so the title and back
 * control clear the status bar on Android edge-to-edge and notched devices.
 */
export function TripStackHeader({ options, route }: NativeStackHeaderProps) {
  const router = useRouter()
  const { colors } = useThemedStyles()
  const title = getHeaderTitle(options, route.name)
  const handleBackPress = () => {
    if (router.canGoBack()) router.back()
    else router.replace('/(tabs)/trips')
  }

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={{ backgroundColor: colors.background }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: 48,
          paddingHorizontal: spacing.xs,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable
          onPress={handleBackPress}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={12}
          style={{
            width: 44,
            height: 44,
            borderRadius: radii.sm,
            backgroundColor: colors.muted,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            textAlign: 'center',
            ...typography.h3,
            color: colors.text,
            marginRight: 44,
          }}
        >
          {title}
        </Text>
      </View>
    </SafeAreaView>
  )
}

export default TripStackHeader
