import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, Sparkles } from 'lucide-react-native';

import { brand } from '@/constants/design';
import { useResponsive } from '@/hooks/use-responsive';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { radii } from '@/lib/ui-styles';

type Props = {
  title: string;
  subtitle?: string;
  onNewChat: () => void;
  disabled?: boolean;
};

export function ChatHeader({ title, subtitle, onNewChat, disabled }: Props) {
  const theme = useThemedStyles();
  const insets = useSafeAreaInsets();
  const { scaleFont, horizontalPadding } = useResponsive();

  return (
    <View
      style={{
        paddingTop: Math.max(insets.top, 8) + 8,
        paddingHorizontal: horizontalPadding,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        backgroundColor: theme.colors.card,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: brand.primaryLight,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Sparkles size={22} color={brand.primaryDark} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{
              color: theme.colors.text,
              fontSize: scaleFont(17),
              fontWeight: '800',
            }}
            numberOfLines={1}
          >
            {title}
          </Text>
          <Text
            style={{
              color: theme.colors.textMuted,
              fontSize: scaleFont(12),
              marginTop: 2,
            }}
            numberOfLines={1}
          >
            {subtitle ?? 'Live weather · hotels · itineraries'}
          </Text>
        </View>
        <Pressable
          onPress={onNewChat}
          disabled={disabled}
          accessibilityLabel="New chat"
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: radii.pill,
            backgroundColor: pressed ? brand.primaryLight : theme.colors.muted,
            opacity: disabled ? 0.5 : 1,
          })}
        >
          <Plus size={18} color={brand.primaryDark} strokeWidth={2.5} />
          <Text
            style={{
              color: brand.primaryDark,
              fontSize: scaleFont(13),
              fontWeight: '700',
            }}
          >
            New
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
