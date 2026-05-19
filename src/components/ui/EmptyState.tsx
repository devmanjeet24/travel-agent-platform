import { Text, View } from 'react-native'
import type { LucideIcon } from 'lucide-react-native'

import { Button } from './Button'
import { useThemedStyles } from '@/hooks/use-themed-styles'

interface Props {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: Props) {
  const theme = useThemedStyles()

  return (
    <View className="items-center justify-center py-16 px-6">
      <View className={`${theme.bgMuted} p-5 rounded-full mb-5`}>
        <Icon size={40} color="#0EA5E9" />
      </View>
      <Text className={`${theme.text} text-xl font-bold text-center`}>{title}</Text>
      <Text className={`${theme.textMuted} text-center mt-2 leading-6`}>
        {description}
      </Text>
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} className="mt-6 w-full" />
      ) : null}
    </View>
  )
}

export default EmptyState
