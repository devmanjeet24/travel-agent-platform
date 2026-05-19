import { Text, TextInput, View, type TextInputProps } from 'react-native'

import { useThemedStyles } from '@/hooks/use-themed-styles'

interface Props extends TextInputProps {
  label?: string
  error?: string
}

export function Input({ label, error, className = '', style, ...props }: Props) {
  const theme = useThemedStyles()

  return (
    <View className="w-full">
      {label ? (
        <Text
          className="text-sm font-medium mb-2"
          style={{ color: theme.colors.text }}
        >
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={theme.colors.textMuted}
        className={`rounded-2xl px-5 py-4 text-base ${className}`}
        style={[
          {
            backgroundColor: theme.colors.card,
            color: theme.colors.text,
            borderColor: theme.colors.border,
            borderWidth: 1,
          },
          style,
        ]}
        {...props}
      />
      {error ? (
        <Text className="text-red-500 text-sm mt-1.5">{error}</Text>
      ) : null}
    </View>
  )
}

export default Input
