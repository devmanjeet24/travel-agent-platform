import { useState } from 'react'
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native'
import { Eye, EyeOff } from 'lucide-react-native'

import { brand, layout, spacing } from '@/constants/design'
import { typography } from '@/constants/typography'
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
  editable = true,
  ...props
}: Props) {
  const theme = useThemedStyles()
  const [focused, setFocused] = useState(false)
  const [passwordVisible, setPasswordVisible] = useState(false)

  const isSecure = showPasswordToggle ? !passwordVisible : secureTextEntry

  return (
    <View style={{ width: '100%', marginBottom: spacing.lg }}>
      {label ? (
        <Text
          style={{
            ...typography.label,
            color: theme.colors.text,
            marginBottom: spacing.sm,
          }}
        >
          {label}
        </Text>
      ) : null}
      <View style={{ position: 'relative', width: '100%' }}>
        <TextInput
          placeholderTextColor={theme.colors.textMuted}
          className={className}
          editable={editable}
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
              minHeight: layout.touchTarget + 6,
              borderRadius: radii.md,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              ...typography.body,
              backgroundColor: theme.colors.muted,
              color: theme.colors.text,
              borderColor: error
                ? brand.danger
                : focused
                  ? brand.primaryDark
                  : theme.colors.border,
              borderWidth: focused || error ? 2 : 1,
              opacity: editable ? 1 : 0.65,
              ...(showPasswordToggle ? { paddingRight: 48 } : null),
            },
            style,
          ]}
          {...props}
        />
        {showPasswordToggle ? (
          <Pressable
            onPress={() => setPasswordVisible((visible) => !visible)}
            hitSlop={12}
            style={{
              position: 'absolute',
              right: spacing.md,
              top: 0,
              bottom: 0,
              justifyContent: 'center',
              minWidth: layout.touchTarget,
              alignItems: 'center',
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
        <Text style={{ color: brand.danger, ...typography.caption, marginTop: spacing.sm }}>
          {error}
        </Text>
      ) : null}
    </View>
  )
}

export default Input
