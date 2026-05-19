import { Image, Text, View } from 'react-native'

interface Props {
  uri?: string
  name?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizes = { sm: 'w-10 h-10', md: 'w-16 h-16', lg: 'w-28 h-28' }
const textSizes = { sm: 'text-sm', md: 'text-lg', lg: 'text-3xl' }

export function Avatar({ uri, name = '?', size = 'md' }: Props) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  if (uri) {
    return (
      <Image
        source={{ uri }}
        className={`${sizes[size]} rounded-full bg-slate-700`}
      />
    )
  }

  return (
    <View
      className={`${sizes[size]} rounded-full bg-sky-500 items-center justify-center`}
    >
      <Text className={`text-white font-bold ${textSizes[size]}`}>
        {initials}
      </Text>
    </View>
  )
}

export default Avatar
