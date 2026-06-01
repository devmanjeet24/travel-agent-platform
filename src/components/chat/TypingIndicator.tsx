import { useEffect, useState } from 'react';
import { Animated, View } from 'react-native';

import { brand } from '@/constants/design';
import { radii } from '@/lib/ui-styles';
import { useThemedStyles } from '@/hooks/use-themed-styles';

function Dot({ delay, color }: { delay: number; color: string }) {
  const [opacity] = useState(() => new Animated.Value(0.35));

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 320, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [delay, opacity]);

  return (
    <Animated.View
      style={{
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: color,
        opacity,
        marginHorizontal: 3,
      }}
    />
  );
}

export function TypingIndicator() {
  const theme = useThemedStyles();
  const dotColor = theme.isDark ? brand.ai : brand.primaryDark;

  return (
    <View
      style={{
        marginBottom: 14,
        maxWidth: '88%',
        alignSelf: 'flex-start',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: radii.xl,
          borderBottomLeftRadius: radii.sm,
          paddingHorizontal: 18,
          paddingVertical: 14,
          backgroundColor: theme.colors.card,
          borderWidth: 1,
          borderColor: theme.colors.border,
        }}
      >
        <Dot delay={0} color={dotColor} />
        <Dot delay={160} color={dotColor} />
        <Dot delay={320} color={dotColor} />
      </View>
    </View>
  );
}
