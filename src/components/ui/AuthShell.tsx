import type { ReactNode } from 'react'
import { Image, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Compass, Sparkles } from 'lucide-react-native'

import { brand, defaultTripImage, spacing } from '@/constants/design'
import { textWithWeight } from '@/constants/inter-typography'
import { typography } from '@/constants/typography'
import { useKeyboardBottomInset } from '@/hooks/use-keyboard-bottom-inset'
import { useResponsive } from '@/hooks/use-responsive'
import { cardShadow, radii } from '@/lib/ui-styles'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import { MaxContentWidth } from '@/constants/theme'

/** Hero height for compact auth — scales with width and caps by viewport height. */
function compactAuthHeroHeight(width: number, height: number, topInset: number, bottomInset: number) {
  const widthBased = width * 0.44
  const heightCap = height * (height < 700 ? 0.28 : height < 820 ? 0.3 : 0.34)
  const absoluteMax = height < 700 ? 176 : height < 820 ? 208 : 248
  const formBudget = 720
  const cardOverlap = spacing['3xl']
  const scrollPadding = Math.max(bottomInset, spacing['3xl'])
  const heroBudget = height - formBudget + cardOverlap - scrollPadding - topInset
  const minHero = height < 700 ? 96 : 108
  const capped = Math.min(widthBased, absoluteMax, heightCap)
  if (heroBudget < minHero) {
    return Math.round(Math.min(capped, Math.max(heroBudget, 88)))
  }
  return Math.round(Math.min(capped, Math.max(heroBudget, minHero)))
}

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
  const insets = useSafeAreaInsets()
  const keyboardInset = useKeyboardBottomInset()
  const { horizontalPadding, scaleFont, useCompactAuth, width, height, contentWidth } = useResponsive()

  const formCard = (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: radii['2xl'],
          borderWidth: 1,
          borderColor: colors.border,
          padding: useCompactAuth ? spacing['2xl'] : spacing['3xl'],
          width: '100%',
          maxWidth: useCompactAuth ? contentWidth : 420,
          alignSelf: 'center',
        },
        cardShadow(isDark),
      ]}
    >
      <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: radii.lg,
            backgroundColor: brand.primary,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing.lg,
          }}
        >
          <Compass size={28} color={brand.onPrimary} strokeWidth={2.5} />
        </View>
        <Text
          style={{
            ...typography.display,
            fontSize: scaleFont(useCompactAuth ? 24 : 28),
            color: colors.text,
            textAlign: 'center',
            letterSpacing: -0.6,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            ...typography.bodySm,
            color: colors.textMuted,
            textAlign: 'center',
            marginTop: spacing.sm,
            maxWidth: 300,
            lineHeight: 20,
          }}
        >
          {subtitle}
        </Text>
      </View>
      <View style={{ width: '100%' }}>{children}</View>
    </View>
  )

  if (useCompactAuth) {
    const heroHeight = compactAuthHeroHeight(width, height, insets.top, insets.bottom)
    const cardOverlap = spacing['3xl']
    const scrollBottomPadding =
      Math.max(insets.bottom, spacing['3xl']) + (Platform.OS === 'android' ? keyboardInset : 0)

    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          enabled={Platform.OS === 'ios'}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: scrollBottomPadding }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            removeClippedSubviews={false}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
          >
            <View style={{ height: heroHeight + insets.top, width: '100%' }}>
              <Image
                source={{ uri: defaultTripImage }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
              <LinearGradient
                colors={['transparent', colors.background]}
                style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: heroHeight * 0.55 }}
              />
              <View
                style={{
                  position: 'absolute',
                  top: insets.top,
                  left: 0,
                  right: 0,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  paddingHorizontal: horizontalPadding,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: radii.md,
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Compass size={20} color="#FFFFFF" />
                </View>
                <Text style={textWithWeight(typography.h3, '700', { color: '#FFFFFF' })}>Travel Agent</Text>
              </View>
            </View>

            <View style={{ marginTop: -cardOverlap, paddingHorizontal: horizontalPadding }}>
              {formCard}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, flexDirection: 'row', minHeight: '100%' }}>
      <View
        style={{
          flex: 1,
          backgroundColor: '#0B1120',
          padding: 48,
          justifyContent: 'center',
          maxWidth: '52%',
          overflow: 'hidden',
        }}
      >
        <Image
          source={{ uri: defaultTripImage }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.35 }}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['rgba(11,17,32,0.7)', 'rgba(11,17,32,0.95)']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <View style={{ maxWidth: 400, zIndex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: radii.md,
                backgroundColor: 'rgba(255,255,255,0.12)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Compass size={24} color="#FFFFFF" />
            </View>
            <Text style={textWithWeight(typography.h2, '700', { color: '#FFFFFF' })}>Travel Agent</Text>
          </View>
          <Text
            style={textWithWeight(typography.display, '800', {
              color: '#FFFFFF',
              fontSize: 40,
              letterSpacing: -1,
              lineHeight: 46,
            })}
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
                    backgroundColor: 'rgba(124, 58, 237, 0.35)',
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

      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        enabled={Platform.OS === 'ios'}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 40,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ width: '100%', maxWidth: MaxContentWidth / 2, alignItems: 'center' }}>
            {formCard}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

export default AuthShell
