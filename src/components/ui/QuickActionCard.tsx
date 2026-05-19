import { Pressable, Text, View } from 'react-native'
import {
  Map,
  MessageSquare,
  Wallet,
  Wand2,
  type LucideIcon,
} from 'lucide-react-native'

import { useThemedStyles } from '@/hooks/use-themed-styles'

const iconMap: Record<string, LucideIcon> = {
  MessageSquare,
  Wand2,
  Map,
  Wallet,
}

interface Props {
  label: string
  icon: keyof typeof iconMap
  color?: string
  onPress?: () => void
}

export function QuickActionCard({ label, icon, color = '#0EA5E9', onPress }: Props) {
  const theme = useThemedStyles()
  const Icon = iconMap[icon] ?? MessageSquare

  return (
    <Pressable
      onPress={onPress}
      className={`${theme.bgCard} ${theme.border} border rounded-2xl p-4 w-[47%] mb-3 active:opacity-90`}
    >
      <View
        className="w-11 h-11 rounded-xl items-center justify-center mb-3"
        style={{ backgroundColor: `${color}22` }}
      >
        <Icon size={22} color={color} />
      </View>
      <Text className={`${theme.text} font-semibold text-sm`}>{label}</Text>
    </Pressable>
  )
}

export default QuickActionCard
