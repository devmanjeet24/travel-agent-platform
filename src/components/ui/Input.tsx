import { useState } from 'react'
import { Text, TextInput, View, type TextInputProps } from 'react-native'

import { brand } from '@/constants/design'
import { radii } from '@/lib/ui-styles'
import { useThemedStyles } from '@/hooks/use-themed-styles'

interface Props extends TextInputProps {
  label?: string
  error?: string
}

export function Input({ label, error, className = '', style, onFocus, onBlur, ...props }: Props) {
  const theme = useThemedStyles()
  const [focused, setFocused] = useState(false)

  return (
    <View style={{ width: '100%', marginBottom: 18 }}>
      {label ? (
        <Text
          style={{
            color: theme.colors.text,
            fontSize: 13,
            fontWeight: '600',
            marginBottom: 8,
            letterSpacing: 0.3,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={theme.colors.textMuted}
        className={className}
        onFocus={(e) => {
          setFocused(true)
          onFocus?.(e)
        }}
        onBlur={(e) => {
          setFocused(false)
          onBlur?.(e)
        }}
        style={[
          {
            width: '100%',
            minHeight: 54,
            borderRadius: radii.md,
            paddingHorizontal: 18,
            paddingVertical: 14,
            fontSize: 16,
            backgroundColor: theme.colors.card,
            color: theme.colors.text,
            borderColor: error
              ? brand.danger
              : focused
                ? brand.primaryDark
                : theme.colors.border,
            borderWidth: focused || error ? 2 : 1,
          },
          style,
        ]}
        {...props}
      />
      {error ? (
        <Text style={{ color: brand.danger, fontSize: 13, marginTop: 6 }}>{error}</Text>
      ) : null}
    </View>
  )
}

export default Input
