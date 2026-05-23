import { Image, Pressable, Text, View } from 'react-native'
import { MapPin } from 'lucide-react-native'

import { brand } from '@/constants/design'
import { cardShadow, radii } from '@/lib/ui-styles'
import { useThemedStyles } from '@/hooks/use-themed-styles'

interface Props {
  name: string
  country: string
  tagline: string
  image: string
  onPress?: () => void
  width?: number
}

export function DestinationCard({
  name,
  country,
  tagline,
  image,
  onPress,
  width = 160,
}: Props) {
  const theme = useThemedStyles()

  return (
    <Pressable
      onPress={onPress}
      style={[
        {
          width,
          marginRight: 14,
          borderRadius: radii.lg,
          overflow: 'hidden',
          backgroundColor: theme.colors.card,
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
        cardShadow(theme.isDark),
      ]}
      className="active:opacity-95"
    >
      <Image source={{ uri: image }} style={{ width: '100%', height: 120 }} resizeMode="cover" />
      <View style={{ padding: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <MapPin size={12} color={brand.primaryDark} />
          <Text style={{ color: brand.primaryDark, fontSize: 11, fontWeight: '600' }}>
            {country}
          </Text>
        </View>
        <Text
          style={{
            color: theme.colors.text,
            fontWeight: '700',
            fontSize: 16,
            marginTop: 4,
          }}
          numberOfLines={1}
        >
          {name}
        </Text>
        <Text
          style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 2 }}
          numberOfLines={1}
        >
          {tagline}
        </Text>
      </View>
    </Pressable>
  )
}

export default DestinationCard
