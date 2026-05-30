import { useThemePreference } from '@/providers/theme-preference-provider'

export function useColorScheme() {
  return useThemePreference().colorScheme
}
