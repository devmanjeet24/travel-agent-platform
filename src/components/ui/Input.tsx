import { Text, TextInput, View, type TextInputProps } from 'react-native'

import { useThemedStyles } from '@/hooks/use-themed-styles'

interface Props extends TextInputProps {
  label?: string
  error?: string
}

export function Input({ label, error, className = '', ...props }: Props) {
  const theme = useThemedStyles()

  return (
    <View className="w-full">
      {label ? (
        <Text className={`${theme.textMuted} text-sm font-medium mb-2`}>
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={theme.isDark ? '#94A3B8' : '#64748B'}
        className={`${theme.bgCard} ${theme.text} ${theme.border} border rounded-2xl px-5 py-4 text-base ${className}`}
        {...props}
      />
      {error ? (
        <Text className="text-red-500 text-sm mt-1.5">{error}</Text>
      ) : null}
    </View>
  )
}

export default Input
