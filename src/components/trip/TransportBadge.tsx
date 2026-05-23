import { Text, View } from 'react-native'
import type { LucideIcon } from 'lucide-react-native'

import { brand } from '@/constants/design'
import { useThemedStyles } from '@/hooks/use-themed-styles'

type Props = {
  icon: LucideIcon
  label: string
  detail?: string
  budgetFriendly?: boolean
  showBudgetHint?: boolean
}

export function TransportBadge({
  icon: Icon,
  label,
  detail,
  budgetFriendly,
  showBudgetHint,
}: Props) {
  const theme = useThemedStyles()

  return (
    <View className="mt-3">
      <View className="flex-row items-center flex-wrap gap-2">
        <View className="flex-row items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
          <Icon size={14} color={brand.primaryDark} />
          <Text className={`${theme.text} text-xs font-semibold capitalize`}>
            {label}
          </Text>
        </View>
        {budgetFriendly && showBudgetHint ? (
          <View className="bg-emerald-100 dark:bg-emerald-900/40 px-2.5 py-1 rounded-lg">
            <Text className="text-emerald-700 dark:text-emerald-300 text-xs font-medium">
              Budget-friendly transport
            </Text>
          </View>
        ) : null}
      </View>
      {detail && detail !== '—' ? (
        <Text className={`${theme.textMuted} text-xs mt-1.5`} numberOfLines={2}>
          {detail}
        </Text>
      ) : null}
    </View>
  )
}
