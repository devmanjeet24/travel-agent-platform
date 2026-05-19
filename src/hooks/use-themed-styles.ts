import { useColorScheme } from 'react-native'

export function useThemedStyles() {
  const scheme = useColorScheme()
  const isDark = scheme !== 'light'

  return {
    isDark,
    bg: isDark ? 'bg-slate-950' : 'bg-slate-50',
    bgCard: isDark ? 'bg-slate-900' : 'bg-white',
    bgMuted: isDark ? 'bg-slate-800' : 'bg-slate-100',
    text: isDark ? 'text-white' : 'text-slate-900',
    textMuted: isDark ? 'text-slate-400' : 'text-slate-500',
    border: isDark ? 'border-slate-800' : 'border-slate-200',
    tabBar: isDark ? '#0F172A' : '#FFFFFF',
    tabBarBorder: isDark ? '#1E293B' : '#E2E8F0',
  }
}
