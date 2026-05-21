import { ActivityIndicator, Pressable, Text, type PressableProps } from 'react-native'

import { brand } from '@/constants/design'
import { radii } from '@/lib/ui-styles'

interface Props extends Omit<PressableProps, 'style'> {
  title: string
  loading?: boolean
}

/**
 * Auth primary CTA — static styles only (no Pressable style callbacks) so the
 * button always renders on Expo Go / Android.
 */
export function PrimaryAuthButton({ title, loading, disabled, onPress, ...props }: Props) {
  const isDisabled = disabled || loading

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      disabled={isDisabled}
      style={{
        width: '100%',
        minHeight: 56,
        borderRadius: radii.pill,
        backgroundColor: brand.primaryDark,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 24,
        opacity: isDisabled ? 0.6 : 1,
        marginTop: 4,
        marginBottom: 4,
      }}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={brand.onPrimary} />
      ) : (
        <Text
          style={{
            color: brand.onPrimary,
            fontSize: 17,
            fontWeight: '700',
          }}
        >
          {title}
        </Text>
      )}
    </Pressable>
  )
}

export default PrimaryAuthButton
