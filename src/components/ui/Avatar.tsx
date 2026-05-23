import { Text, View } from 'react-native'
import { Image } from 'expo-image'

import { brand } from '@/constants/design'

interface Props {
  uri?: string
  name?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizes = { sm: 40, md: 64, lg: 112 }
const textSizes = { sm: 14, md: 20, lg: 36 }

export function Avatar({ uri, name = '?', size = 'md' }: Props) {
  const dim = sizes[size]
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const ringStyle = {
    width: dim + 8,
    height: dim + 8,
    borderRadius: (dim + 8) / 2,
    borderWidth: 3,
    borderColor: brand.primaryDark,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  }

  if (uri) {
    return (
      <View style={ringStyle}>
        <Image
          key={uri}
          source={{ uri }}
          style={{ width: dim, height: dim, borderRadius: dim / 2 }}
          cachePolicy="none"
          recyclingKey={uri}
        />
      </View>
    )
  }

  return (
    <View style={ringStyle}>
      <View
        style={{
          width: dim,
          height: dim,
          borderRadius: dim / 2,
          backgroundColor: brand.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: brand.onPrimary, fontWeight: '800', fontSize: textSizes[size] }}>
          {initials}
        </Text>
      </View>
    </View>
  )
}

export default Avatar
