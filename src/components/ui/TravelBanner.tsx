import { Image, Pressable, Text, View } from 'react-native'
import { ArrowRight } from 'lucide-react-native'

import { brand } from '@/constants/design'
import { useResponsive } from '@/hooks/use-responsive'
import { cardShadow, radii } from '@/lib/ui-styles'
import { useThemedStyles } from '@/hooks/use-themed-styles'

interface Props {
  title: string
  subtitle: string
  image: string
  cta: string
  onPress?: () => void
}

export function TravelBanner({ title, subtitle, image, cta, onPress }: Props) {
  const theme = useThemedStyles()
  const { bannerWidth, scaleFont, isSmallPhone } = useResponsive()
  const bannerHeight = Math.min(bannerWidth * 0.58, isSmallPhone ? 150 : 180)

  return (
    <Pressable
      onPress={onPress}
      style={[
        {
          width: bannerWidth,
          marginRight: 14,
          borderRadius: radii.xl,
          overflow: 'hidden',
          height: bannerHeight,
        },
        cardShadow(theme.isDark),
      ]}
    >
      <Image source={{ uri: image }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          padding: isSmallPhone ? 14 : 18,
          justifyContent: 'flex-end',
        }}
      >
        <Text style={{ color: '#FFFFFF', fontSize: scaleFont(18), fontWeight: '800' }} numberOfLines={1}>
          {title}
        </Text>
        <Text
          style={{ color: 'rgba(255,255,255,0.9)', fontSize: scaleFont(12), marginTop: 4 }}
          numberOfLines={2}
        >
          {subtitle}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
          <Text style={{ color: brand.primary, fontWeight: '700', fontSize: scaleFont(13) }}>{cta}</Text>
          <ArrowRight size={16} color={brand.primary} />
        </View>
      </View>
    </Pressable>
  )
}

export default TravelBanner
