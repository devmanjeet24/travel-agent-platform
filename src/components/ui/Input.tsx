import { Text, TextInput, View, type TextInputProps } from 'react-native'

import { useThemedStyles } from '@/hooks/use-themed-styles'

interface Props extends TextInputProps {
  label?: string
  error?: string
}

export function Input({ label, error, className = '', style, ...props }: Props) {
  const theme = useThemedStyles()

  return (
    <View style={{ width: '100%', marginBottom: 16 }}>
      {label ? (
        <Text
          style={{
            color: theme.colors.text,
            fontSize: 14,
            fontWeight: '500',
            marginBottom: 8,
          }}
        >
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={theme.colors.textMuted}
        className={className}
        style={[
          {
            width: '100%',
            minHeight: 52,
            borderRadius: 16,
            paddingHorizontal: 20,
            paddingVertical: 14,
            fontSize: 16,
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
        <Text style={{ color: '#EF4444', fontSize: 14, marginTop: 6 }}>
          {error}
        </Text>
      ) : null}
    </View>
  )
}

export default Input
