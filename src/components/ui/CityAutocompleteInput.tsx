import { useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native'
import { MapPin } from 'lucide-react-native'

import { brand } from '@/constants/design'
import { useCitySuggestions } from '@/hooks/travel/use-city-suggestions'
import { radii } from '@/lib/ui-styles'
import { useThemedStyles } from '@/hooks/use-themed-styles'

/** Match TextInput horizontal inset in this component. */
const DROPDOWN_INSET = 20
const ITEM_MIN_HEIGHT = 56
const ICON_SIZE = 18
const ICON_TEXT_GAP = 14
const TITLE_SUBTITLE_GAP = 6

interface Props extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  label?: string
  error?: string
  value: string
  onChangeText: (text: string) => void
  /** Raise dropdown above fields below (destination > origin). */
  listZIndex?: number
}

export function CityAutocompleteInput({
  label,
  error,
  value,
  onChangeText,
  listZIndex = 1,
  placeholder,
  onFocus,
  onBlur,
  ...props
}: Props) {
  const theme = useThemedStyles()
  const [focused, setFocused] = useState(false)
  const selectingRef = useRef(false)

  const { data: suggestions = [], isFetching, isFetched } = useCitySuggestions(
    value,
    focused,
  )

  const showDropdown =
    focused && value.trim().length >= 2 && (isFetching || suggestions.length > 0)

  const handleSelect = (selected: string) => {
    onChangeText(selected)
    selectingRef.current = false
    setFocused(false)
  }

  const itemRowStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    minHeight: ITEM_MIN_HEIGHT,
    paddingLeft: DROPDOWN_INSET,
    paddingRight: DROPDOWN_INSET,
    paddingTop: 14,
    paddingBottom: 14,
  }

  const itemTextBlockStyle = {
    flex: 1,
    justifyContent: 'center' as const,
    paddingLeft: ICON_TEXT_GAP,
  }

  return (
    <View style={{ width: '100%', marginBottom: 18, zIndex: showDropdown ? listZIndex : 0 }}>
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
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          autoCorrect={false}
          autoCapitalize="words"
          onFocus={(e) => {
            setFocused(true)
            onFocus?.(e)
          }}
          onBlur={(e) => {
            setTimeout(() => {
              if (!selectingRef.current) setFocused(false)
            }, 160)
            onBlur?.(e)
          }}
          style={{
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
          }}
          {...props}
        />

        {showDropdown ? (
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: '100%',
              marginTop: 8,
              borderRadius: radii.md,
              backgroundColor: theme.colors.card,
              borderWidth: 1,
              borderColor: theme.colors.border,
              overflow: 'hidden',
              paddingTop: 8,
              paddingBottom: 8,
              shadowColor: '#0f172a',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.12,
              shadowRadius: 8,
              elevation: 6,
            }}
          >
            {isFetching && suggestions.length === 0 ? (
              <View style={itemRowStyle}>
                <ActivityIndicator size="small" color={brand.primaryDark} />
                <Text
                  style={{
                    color: theme.colors.textMuted,
                    fontSize: 15,
                    lineHeight: 22,
                    flex: 1,
                    paddingLeft: ICON_TEXT_GAP,
                  }}
                >
                  Searching cities…
                </Text>
              </View>
            ) : null}

            {suggestions.map((item, index) => (
              <View key={item.id}>
                {index > 0 ? (
                  <View
                    style={{
                      height: 1,
                      backgroundColor: theme.colors.border,
                      marginLeft: DROPDOWN_INSET,
                      marginRight: DROPDOWN_INSET,
                    }}
                  />
                ) : null}
                <Pressable
                  onPressIn={() => {
                    selectingRef.current = true
                  }}
                  onPress={() => handleSelect(item.value)}
                  style={({ pressed }) => ({
                    backgroundColor: pressed ? brand.primaryLight : theme.colors.card,
                  })}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.label}, ${item.subtitle}`}
                >
                  <View style={itemRowStyle}>
                    <MapPin size={ICON_SIZE} color={brand.primaryDark} strokeWidth={2} />
                    <View style={itemTextBlockStyle}>
                      <Text
                        style={{
                          color: theme.colors.text,
                          fontSize: 16,
                          fontWeight: '600',
                          lineHeight: 22,
                        }}
                        numberOfLines={1}
                      >
                        {item.label}
                      </Text>
                      {item.subtitle ? (
                        <Text
                          style={{
                            color: theme.colors.textMuted,
                            fontSize: 13,
                            lineHeight: 18,
                            marginTop: TITLE_SUBTITLE_GAP,
                          }}
                          numberOfLines={1}
                        >
                          {item.subtitle}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </Pressable>
              </View>
            ))}

            {isFetched && !isFetching && suggestions.length === 0 ? (
              <View
                style={{
                  minHeight: ITEM_MIN_HEIGHT,
                  paddingLeft: DROPDOWN_INSET,
                  paddingRight: DROPDOWN_INSET,
                  paddingTop: 16,
                  paddingBottom: 16,
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    color: theme.colors.textMuted,
                    fontSize: 15,
                    lineHeight: 22,
                  }}
                >
                  No cities found — try another spelling
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
      {error ? (
        <Text style={{ color: brand.danger, fontSize: 13, marginTop: 6 }}>{error}</Text>
      ) : null}
    </View>
  )
}

export default CityAutocompleteInput
