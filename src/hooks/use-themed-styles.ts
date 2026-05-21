import { useColorScheme } from 'react-native'

import { brand } from '@/constants/design'

export function useThemedStyles() {
  const scheme = useColorScheme()
  const isDark = scheme === 'dark'

  const colors = isDark
    ? {
        background: '#0F172A',
        card: '#1E293B',
        muted: '#334155',
        text: '#F8FAFC',
        textMuted: '#94A3B8',
        border: '#475569',
        primary: brand.primary,
        primaryDark: brand.primaryDark,
        accent: brand.accent,
      }
    : {
        background: '#F0F9FF',
        card: '#FFFFFF',
        muted: '#E0F2FE',
        text: '#0F172A',
        textMuted: '#475569',
        border: '#CBD5E1',
        primary: brand.primary,
        primaryDark: brand.primaryDark,
        accent: brand.accent,
      }

  return {
    isDark,
    colors,
    bg: isDark ? 'bg-slate-900' : 'bg-sky-50',
    bgCard: isDark ? 'bg-slate-800' : 'bg-white',
    bgMuted: isDark ? 'bg-slate-800' : 'bg-slate-100',
    text: isDark ? 'text-white' : 'text-slate-900',
    textMuted: isDark ? 'text-slate-400' : 'text-slate-500',
    border: isDark ? 'border-slate-700' : 'border-slate-200',
    tabBar: isDark ? '#0F172A' : '#FFFFFF',
    tabBarBorder: isDark ? '#1E293B' : '#E2E8F0',
  }
}
