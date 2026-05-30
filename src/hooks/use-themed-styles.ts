import { useColorScheme } from '@/hooks/use-color-scheme'

import { brand } from '@/constants/design'

/** Semantic palette — neutral surfaces with sky accent; soft navy dark mode. */
export function useThemedStyles() {
  const scheme = useColorScheme()
  const isDark = scheme === 'dark'

  const colors = isDark
    ? {
        background: '#0B1120',
        backgroundGradient: '#0F172A',
        card: '#131C2E',
        cardElevated: '#182236',
        muted: '#1A2438',
        text: '#F8FAFC',
        textMuted: '#94A3B8',
        border: '#243044',
        borderSubtle: '#1A2438',
        primary: brand.primary,
        primaryDark: brand.primaryDark,
        primaryLight: 'rgba(37, 99, 235, 0.14)',
        accent: brand.accent,
        accentMuted: 'rgba(99, 102, 241, 0.18)',
        ai: brand.ai,
        aiMuted: 'rgba(124, 58, 237, 0.18)',
        icon: '#64748B',
        overlay: 'rgba(0,0,0,0.52)',
      }
    : {
        background: '#FAFBFC',
        backgroundGradient: '#F4F6F9',
        card: '#FFFFFF',
        cardElevated: '#FFFFFF',
        muted: '#F4F6F9',
        text: '#0F172A',
        textMuted: '#64748B',
        border: '#E8ECF1',
        borderSubtle: '#F1F4F8',
        primary: brand.primary,
        primaryDark: brand.primaryDark,
        primaryLight: brand.primaryLight,
        accent: brand.accent,
        accentMuted: brand.accentMuted,
        ai: brand.ai,
        aiMuted: brand.aiMuted,
        icon: '#94A3B8',
        overlay: 'rgba(15, 23, 42, 0.42)',
      }

  return {
    isDark,
    colors,
    bg: isDark ? 'bg-slate-950' : 'bg-slate-50',
    bgCard: isDark ? 'bg-slate-900' : 'bg-white',
    bgMuted: isDark ? 'bg-slate-800' : 'bg-slate-100',
    text: isDark ? 'text-slate-50' : 'text-slate-900',
    textMuted: isDark ? 'text-slate-400' : 'text-slate-500',
    border: isDark ? 'border-slate-700' : 'border-slate-200',
    tabBar: isDark ? '#131C2E' : '#FFFFFF',
    tabBarBorder: isDark ? '#243044' : '#E8ECF1',
  }
}
