import { useState } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { Calendar } from 'lucide-react-native'

import { brand } from '@/constants/design'
import { radii } from '@/lib/ui-styles'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import { formatIsoDateDisplay, parseIsoDateString, toIsoDateString } from '@/utils/date-format'

interface Props {
  label?: string
  value: string
  onChange: (iso: string) => void
  placeholder?: string
  minimumDate?: Date
  maximumDate?: Date
  error?: string
}

export function DatePickerField({
  label,
  value,
  onChange,
  placeholder = 'Select date',
  minimumDate,
  maximumDate,
  error,
}: Props) {
  const theme = useThemedStyles()
  const [active, setActive] = useState(false)
  const [showPicker, setShowPicker] = useState(false)

  const selected = parseIsoDateString(value)
  const pickerValue = selected ?? minimumDate ?? new Date()

  const handlePress = () => {
    setActive(true)
    setShowPicker(true)
  }

  const handleChange = (event: DateTimePickerEvent, date?: Date) => {
    if (event.type === 'dismissed') {
      setShowPicker(false)
      setActive(false)
      return
    }
    if (date) {
      onChange(toIsoDateString(date))
    }
    if (Platform.OS === 'android') {
      setShowPicker(false)
      setActive(false)
    }
  }

  const display = value ? formatIsoDateDisplay(value) : ''
  const showIosInline = Platform.OS === 'ios' && showPicker
  const showAndroidDialog = Platform.OS === 'android' && showPicker
  const showWebPicker = Platform.OS === 'web' && showPicker

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
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={label ? `${label}, ${display || placeholder}` : display || placeholder}
        style={{
          width: '100%',
          minHeight: 54,
          borderRadius: radii.md,
          paddingHorizontal: 18,
          paddingVertical: 14,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: theme.colors.card,
          borderColor: error ? brand.danger : active ? brand.primaryDark : theme.colors.border,
          borderWidth: active || error ? 2 : 1,
        }}
      >
        <Text
          style={{
            fontSize: 16,
            color: display ? theme.colors.text : theme.colors.textMuted,
            flex: 1,
          }}
        >
          {display || placeholder}
        </Text>
        <Calendar size={20} color={theme.colors.textMuted} strokeWidth={2} />
      </Pressable>
      {showIosInline ? (
        <View style={{ marginTop: 8, borderRadius: radii.md, overflow: 'hidden' }}>
          <DateTimePicker
            value={pickerValue}
            mode="date"
            display="inline"
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            onChange={handleChange}
          />
        </View>
      ) : null}
      {showAndroidDialog || showWebPicker ? (
        <DateTimePicker
          value={pickerValue}
          mode="date"
          display={Platform.OS === 'android' ? 'calendar' : 'default'}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={handleChange}
        />
      ) : null}
      {error ? (
        <Text style={{ color: brand.danger, fontSize: 13, marginTop: 6 }}>{error}</Text>
      ) : null}
    </View>
  )
}

export default DatePickerField
