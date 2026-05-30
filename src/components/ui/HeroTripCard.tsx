import { useState } from 'react'
import { Image, Pressable, Text, View } from 'react-native'
import { ArrowUpRight, Calendar } from 'lucide-react-native'
import { LinearGradient } from 'expo-linear-gradient'

import { brand, defaultTripImage, spacing } from '@/constants/design'
import { textWithWeight } from '@/constants/inter-typography'
import { typography } from '@/constants/typography'
import { useResponsive } from '@/hooks/use-responsive'
import { cardShadow, radii } from '@/lib/ui-styles'
import { useThemedStyles } from '@/hooks/use-themed-styles'

interface Props {
  imageUri: string
  eyebrow: string
  title: string
  dates: string
  onPress: () => void
  /** When false, caller controls vertical spacing (e.g. after SectionTitle). */
  withTopMargin?: boolean
}

export function HeroTripCard({
  imageUri,
  eyebrow,
  title,
  dates,
  onPress,
  withTopMargin = false,
}: Props) {
  const { isDark } = useThemedStyles()
  const { width, scaleFont, isSmallPhone } = useResponsive()
  const heroHeight = Math.min(Math.max(width * 0.52, 200), 300)
  const [failedImageUri, setFailedImageUri] = useState<string | null>(null)
  const imageSource = failedImageUri === imageUri ? defaultTripImage : imageUri

  return (
    <Pressable
      onPress={onPress}
      style={[
        {
          marginTop: withTopMargin ? spacing.lg : 0,
          borderRadius: radii['2xl'],
          overflow: 'hidden',
          height: heroHeight,
          width: '100%',
          alignSelf: 'stretch',
        },
        cardShadow(isDark),
      ]}
    >
      <Image
        key={imageSource}
        source={{ uri: imageSource }}
        style={{ width: '100%', height: '100%' }}
        resizeMode="cover"
        onError={() => {
          if (imageSource !== defaultTripImage) setFailedImageUri(imageUri)
        }}
      />
      <LinearGradient
        colors={['rgba(0,0,0,0.35)', 'transparent', 'rgba(0,0,0,0.75)']}
        locations={[0, 0.35, 1]}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          padding: isSmallPhone ? spacing.lg : spacing.xl,
          justifyContent: 'space-between',
        }}
      >
        <View
          style={{
            alignSelf: 'flex-start',
            backgroundColor: 'rgba(255,255,255,0.94)',
            paddingHorizontal: spacing.md,
            paddingVertical: 6,
            borderRadius: radii.pill,
          }}
        >
          <Text style={textWithWeight(typography.caption, '700', { color: brand.primaryDark })}>
            {eyebrow}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
          <View style={{ flex: 1, paddingRight: spacing.md, minWidth: 0 }}>
            <Text
              style={textWithWeight(typography.h1, '800', {
                color: '#FFFFFF',
                fontSize: scaleFont(isSmallPhone ? 22 : 26),
                letterSpacing: -0.6,
                lineHeight: scaleFont(isSmallPhone ? 28 : 32),
              })}
              numberOfLines={2}
            >
              {title}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }}>
              <Calendar size={14} color="rgba(255,255,255,0.88)" />
              <Text
                style={textWithWeight(typography.caption, '500', {
                  color: 'rgba(255,255,255,0.88)',
                  fontSize: scaleFont(13),
                  marginLeft: 6,
                })}
                numberOfLines={1}
              >
                {dates}
              </Text>
            </View>
          </View>
          <View
            style={{
              width: isSmallPhone ? 46 : 50,
              height: isSmallPhone ? 46 : 50,
              borderRadius: radii.pill,
              backgroundColor: brand.primary,
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ArrowUpRight size={22} color={brand.onPrimary} strokeWidth={2.5} />
          </View>
        </View>
      </View>
    </Pressable>
  )
}

export default HeroTripCard
