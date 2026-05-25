import { useEffect, useState } from 'react'
import { Image, Pressable, Text, View } from 'react-native'
import { ArrowUpRight, Calendar } from 'lucide-react-native'

import { brand, defaultTripImage } from '@/constants/design'
import { useResponsive } from '@/hooks/use-responsive'
import { cardShadow, radii } from '@/lib/ui-styles'
import { useThemedStyles } from '@/hooks/use-themed-styles'

interface Props {
  imageUri: string
  eyebrow: string
  title: string
  dates: string
  onPress: () => void
}

export function HeroTripCard({ imageUri, eyebrow, title, dates, onPress }: Props) {
  const { isDark } = useThemedStyles()
  const { width, scaleFont, isSmallPhone } = useResponsive()
  const heroHeight = Math.min(Math.max(width * 0.48, 180), 280)
  const [imageFailed, setImageFailed] = useState(false)
  const imageSource = imageFailed ? defaultTripImage : imageUri

  useEffect(() => {
    setImageFailed(false)
  }, [imageUri])

  return (
    <Pressable
      onPress={onPress}
      style={[
        {
          marginTop: 20,
          borderRadius: radii.xl,
          overflow: 'hidden',
          height: heroHeight,
          width: '100%',
        },
        cardShadow(isDark),
      ]}
    >
      <Image
        source={{ uri: imageSource }}
        style={{ width: '100%', height: '100%' }}
        resizeMode="cover"
        onError={() => {
          if (imageSource !== defaultTripImage) setImageFailed(true)
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.35)',
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          padding: isSmallPhone ? 16 : 20,
          justifyContent: 'space-between',
        }}
      >
        <View
          style={{
            alignSelf: 'flex-start',
            backgroundColor: brand.primaryDark,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: radii.pill,
          }}
        >
          <Text style={{ color: brand.onPrimary, fontSize: scaleFont(12), fontWeight: '700' }}>
            {eyebrow}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
          <View style={{ flex: 1, paddingRight: 12, minWidth: 0 }}>
            <Text
              style={{
                color: '#FFFFFF',
                fontSize: scaleFont(isSmallPhone ? 22 : 26),
                fontWeight: '700',
                letterSpacing: -0.5,
              }}
              numberOfLines={2}
            >
              {title}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <Calendar size={14} color="rgba(255,255,255,0.85)" />
              <Text
                style={{ color: 'rgba(255,255,255,0.85)', fontSize: scaleFont(13) }}
                numberOfLines={1}
              >
                {dates}
              </Text>
            </View>
          </View>
          <View
            style={{
              width: isSmallPhone ? 40 : 48,
              height: isSmallPhone ? 40 : 48,
              borderRadius: isSmallPhone ? 20 : 24,
              backgroundColor: brand.primaryDark,
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
