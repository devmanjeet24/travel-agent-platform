import type { ReactNode } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Compass, Sparkles } from 'lucide-react-native'

import { brand } from '@/constants/design'
import { useResponsive } from '@/hooks/use-responsive'
import { cardShadow, radii } from '@/lib/ui-styles'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import { MaxContentWidth } from '@/constants/theme'

interface Props {
  title: string
  subtitle: string
  children: ReactNode
}

const highlights = [
  'AI itineraries with live weather & flights',
  'Smart budgets and packing lists',
  'Maps and routes for every stop',
]

export function AuthShell({ title, subtitle, children }: Props) {
  const { colors, isDark } = useThemedStyles()
  const { horizontalPadding, scaleFont, useCompactAuth, width, contentWidth } = useResponsive()

  const formCard = (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: radii.xl,
          borderWidth: 1,
          borderColor: colors.border,
          padding: useCompactAuth ? 24 : 36,
          width: '100%',
          maxWidth: useCompactAuth ? contentWidth : 420,
          alignSelf: 'center',
        },
        cardShadow(isDark),
      ]}
    >
      <View style={{ alignItems: 'center', marginBottom: 28 }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            backgroundColor: brand.primaryDark,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 18,
          }}
        >
          <Compass size={32} color={brand.onPrimary} strokeWidth={2.5} />
        </View>
        <Text
          style={{
            color: colors.text,
            fontSize: scaleFont(useCompactAuth ? 26 : 28),
            fontWeight: '800',
            letterSpacing: -0.5,
            textAlign: 'center',
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            color: colors.textMuted,
            fontSize: scaleFont(15),
            lineHeight: 22,
            textAlign: 'center',
            marginTop: 8,
            maxWidth: 300,
          }}
        >
          {subtitle}
        </Text>
      </View>
      <View style={{ width: '100%' }}>{children}</View>
    </View>
  )

  if (useCompactAuth) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -width * 0.2,
            right: -width * 0.15,
            width: width * 0.7,
            height: width * 0.7,
            borderRadius: width * 0.35,
            backgroundColor: 'rgba(56, 189, 248, 0.18)',
          }}
        />
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingHorizontal: horizontalPadding,
            paddingVertical: 24,
            paddingBottom: 36,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {formCard}
        </ScrollView>
      </SafeAreaView>
    )
  }

  return (
    <View style={{ flex: 1, flexDirection: 'row', minHeight: '100%' }}>
      <View
        style={{
          flex: 1,
          backgroundColor: brand.primaryDark,
          padding: 48,
          justifyContent: 'center',
          maxWidth: '52%',
          overflow: 'hidden',
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -80,
            right: -60,
            width: 280,
            height: 280,
            borderRadius: 140,
            backgroundColor: 'rgba(255,255,255,0.12)',
          }}
        />
        <View style={{ maxWidth: 400, zIndex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: radii.md,
                backgroundColor: 'rgba(255,255,255,0.2)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Compass size={24} color="#FFFFFF" />
            </View>
            <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '700' }}>Travel Agent</Text>
          </View>
          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 40,
              fontWeight: '800',
              letterSpacing: -1,
              lineHeight: 46,
            }}
          >
            Plan trips that feel effortless.
          </Text>
          <Text
            style={{
              color: 'rgba(255,255,255,0.85)',
              fontSize: 16,
              lineHeight: 26,
              marginTop: 16,
            }}
          >
            Your AI co-pilot for destinations, budgets, and day-by-day itineraries.
          </Text>
          <View style={{ marginTop: 36, gap: 14 }}>
            {highlights.map((item) => (
              <View key={item} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Sparkles size={14} color="#FFFFFF" />
                </View>
                <Text style={{ color: 'rgba(255,255,255,0.95)', fontSize: 15 }}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 40,
        }}
      >
        <View style={{ width: '100%', maxWidth: MaxContentWidth / 2, alignItems: 'center' }}>
          {formCard}
        </View>
      </View>
    </View>
  )
}

export default AuthShell
