import { useState } from 'react'
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native'
import { Eye, EyeOff } from 'lucide-react-native'

import { brand } from '@/constants/design'
import { radii } from '@/lib/ui-styles'
import { useThemedStyles } from '@/hooks/use-themed-styles'

interface Props extends TextInputProps {
  label?: string
  error?: string
  showPasswordToggle?: boolean
}

export function Input({
  label,
  error,
  className = '',
  style,
  onFocus,
  onBlur,
  showPasswordToggle,
  secureTextEntry,
  ...props
}: Props) {
  const theme = useThemedStyles()
  const [focused, setFocused] = useState(false)
  const [passwordVisible, setPasswordVisible] = useState(false)

  const isSecure = showPasswordToggle ? !passwordVisible : secureTextEntry

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
      <View style={{ position: 'relative', width: '100%' }}>
        <TextInput
          placeholderTextColor={theme.colors.textMuted}
          className={className}
          secureTextEntry={isSecure}
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
              ...(showPasswordToggle ? { paddingRight: 48 } : null),
            },
            style,
          ]}
          {...props}
        />
        {showPasswordToggle ? (
          <Pressable
            onPress={() => setPasswordVisible((visible) => !visible)}
            hitSlop={8}
            style={{
              position: 'absolute',
              right: 14,
              top: 0,
              bottom: 0,
              justifyContent: 'center',
            }}
            accessibilityRole="button"
            accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
          >
            {passwordVisible ? (
              <Eye size={20} color={theme.colors.textMuted} strokeWidth={2} />
            ) : (
              <EyeOff size={20} color={theme.colors.textMuted} strokeWidth={2} />
            )}
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={{ color: brand.danger, fontSize: 13, marginTop: 6 }}>{error}</Text>
      ) : null}
    </View>
  )
}

export default Input
