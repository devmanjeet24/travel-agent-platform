import { Text } from 'react-native'

import { useThemedStyles } from '@/hooks/use-themed-styles'

interface Props {
  title: string
}

export default function SectionTitle({ title }: Props) {
  const theme = useThemedStyles()

  return (
    <Text className={`${theme.text} text-2xl font-bold mt-6 mb-4`}>
      {title}
    </Text>
  )
}