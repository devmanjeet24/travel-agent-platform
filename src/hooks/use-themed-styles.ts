import { useColorScheme } from 'react-native'

import { brand } from '@/constants/design'

/** Light-first travel palette; dark mode uses soft navy (not pure black). */
export function useThemedStyles() {
  const scheme = useColorScheme()
  const isDark = scheme === 'dark'

  const colors = isDark
    ? {
        background: '#0C1929',
        backgroundGradient: '#0F2744',
        card: '#152238',
        muted: '#1E3A5F',
        text: '#F8FAFC',
        textMuted: '#94A3B8',
        border: '#2E4A6F',
        primary: brand.primary,
        primaryDark: brand.primaryDark,
        primaryLight: '#1E3A5F',
        accent: brand.accent,
        icon: '#94A3B8',
      }
    : {
        background: '#F0F9FF',
        backgroundGradient: '#E0F2FE',
        card: '#FFFFFF',
        muted: '#E0F2FE',
        text: '#0F172A',
        textMuted: '#64748B',
        border: '#BAE6FD',
        primary: brand.primary,
        primaryDark: brand.primaryDark,
        primaryLight: brand.primaryLight,
        accent: brand.accent,
        icon: '#64748B',
      }

  return {
    isDark,
    colors,
    bg: isDark ? 'bg-slate-900' : 'bg-sky-50',
    bgCard: isDark ? 'bg-slate-800' : 'bg-white',
    bgMuted: isDark ? 'bg-slate-800' : 'bg-sky-100',
    text: isDark ? 'text-white' : 'text-slate-900',
    textMuted: isDark ? 'text-slate-400' : 'text-slate-500',
    border: isDark ? 'border-slate-700' : 'border-sky-200',
    tabBar: isDark ? '#152238' : '#FFFFFF',
    tabBarBorder: isDark ? '#2E4A6F' : '#E0F2FE',
    accentText: 'text-sky-500',
    accentBg: 'bg-sky-500/15',
  }
}
