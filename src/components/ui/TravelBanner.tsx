import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { ArrowRight } from 'lucide-react-native'
import { LinearGradient } from 'expo-linear-gradient'

import { spacing } from '@/constants/design'
import { textWithWeight } from '@/constants/inter-typography'
import { typography } from '@/constants/typography'
import { useResponsive } from '@/hooks/use-responsive'
import { radii } from '@/lib/ui-styles'
import { useThemedStyles } from '@/hooks/use-themed-styles'

interface Props {
  title: string
  subtitle: string
  image: string
  cta: string
  width: number
  height: number
  onPress?: () => void
}

export function TravelBanner({ title, subtitle, image, cta, width, height, onPress }: Props) {
  const theme = useThemedStyles()
  const { scaleFont, isSmallPhone } = useResponsive()

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.96 : 1 })}
    >
      <View style={[styles.card, { width, height, backgroundColor: theme.colors.muted }]}>
        <Image source={{ uri: image }} style={{ width, height }} resizeMode="cover" />
        <LinearGradient
          colors={['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.78)']}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFillObject}
        />
        <View
          style={[
            StyleSheet.absoluteFillObject,
            {
              padding: isSmallPhone ? spacing.lg : spacing.xl,
              justifyContent: 'flex-end',
            },
          ]}
        >
          <Text
            style={textWithWeight(typography.h2, '700', {
              color: '#FFFFFF',
              fontSize: scaleFont(17),
              letterSpacing: -0.3,
            })}
            numberOfLines={1}
          >
            {title}
          </Text>
          <Text
            style={{
              color: 'rgba(255,255,255,0.88)',
              fontSize: scaleFont(12),
              marginTop: spacing.xs,
              lineHeight: 18,
            }}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
          <View style={styles.ctaRow}>
            <Text
              style={textWithWeight(typography.caption, '700', {
                color: '#FFFFFF',
                fontSize: scaleFont(12),
              })}
            >
              {cta}
            </Text>
            <ArrowRight size={14} color="#FFFFFF" style={{ marginLeft: 6 }} />
          </View>
        </View>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii['2xl'],
    overflow: 'hidden',
    elevation: 0,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
  },
})

export default TravelBanner
