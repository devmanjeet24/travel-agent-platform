import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { MapPin } from 'lucide-react-native'
import { LinearGradient } from 'expo-linear-gradient'

import { spacing } from '@/constants/design'
import { textWithWeight } from '@/constants/inter-typography'
import { typography } from '@/constants/typography'
import { radii } from '@/lib/ui-styles'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import { useResponsive } from '@/hooks/use-responsive'

interface Props {
  name: string
  country: string
  tagline: string
  image: string
  onPress?: () => void
  width?: number
  height?: number
}

export function DestinationCard({
  name,
  country,
  tagline,
  image,
  onPress,
  width = 156,
  height,
}: Props) {
  const theme = useThemedStyles()
  const { scaleFont } = useResponsive()
  const cardHeight = height ?? Math.round(width * 1.35)

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.94 : 1 })}>
      <View style={[styles.card, { width, height: cardHeight, backgroundColor: theme.colors.muted }]}>
        <Image source={{ uri: image }} style={{ width, height: cardHeight }} resizeMode="cover" />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.72)']}
          locations={[0.35, 0.6, 1]}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={[styles.countryPill, { maxWidth: width - spacing.md * 2 }]}>
          <MapPin size={10} color="#1D4ED8" />
          <Text
            style={textWithWeight(typography.caption, '600', {
              color: '#1D4ED8',
              marginLeft: 4,
            })}
            numberOfLines={1}
          >
            {country}
          </Text>
        </View>
        <View style={styles.footer}>
          <Text
            style={textWithWeight(typography.h2, '700', {
              color: '#FFFFFF',
              fontSize: scaleFont(17),
              letterSpacing: -0.3,
            })}
            numberOfLines={1}
          >
            {name}
          </Text>
          <Text
            style={{
              ...typography.caption,
              color: 'rgba(255,255,255,0.82)',
              marginTop: 2,
            }}
            numberOfLines={1}
          >
            {tagline}
          </Text>
        </View>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    overflow: 'hidden',
    elevation: 0,
  },
  countryPill: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  footer: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
  },
})

export default DestinationCard
