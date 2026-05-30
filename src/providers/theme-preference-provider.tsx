import AsyncStorage from '@react-native-async-storage/async-storage'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useColorScheme as useRNColorScheme } from 'react-native'

const THEME_PREFERENCE_STORAGE_KEY = 'travel-agent.theme-preference.v1'

export type ThemePreference = 'light' | 'dark' | 'system'
type ResolvedThemeScheme = 'light' | 'dark'

type ThemePreferenceContextValue = {
  preference: ThemePreference
  colorScheme: ResolvedThemeScheme
  setPreference: (next: ThemePreference) => Promise<void>
  isHydrated: boolean
}

const ThemePreferenceContext = createContext<ThemePreferenceContextValue | null>(null)

export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const systemScheme = useRNColorScheme()
  const [preference, setPreferenceState] = useState<ThemePreference>('dark')
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(THEME_PREFERENCE_STORAGE_KEY)
        if (!active || !raw) return
        if (raw === 'light' || raw === 'dark' || raw === 'system') {
          setPreferenceState(raw)
        }
      } catch (error) {
        console.warn('[theme] failed to read preference from storage', error)
      } finally {
        if (active) setIsHydrated(true)
      }
    })()

    return () => {
      active = false
    }
  }, [])

  const setPreference = useCallback(async (next: ThemePreference) => {
    setPreferenceState(next)
    try {
      await AsyncStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, next)
    } catch (error) {
      console.warn('[theme] failed to persist preference', error)
    }
  }, [])

  const colorScheme: ResolvedThemeScheme =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference

  const value = useMemo<ThemePreferenceContextValue>(
    () => ({
      preference,
      colorScheme,
      setPreference,
      isHydrated,
    }),
    [preference, colorScheme, setPreference, isHydrated],
  )

  return <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>
}

export function useThemePreference() {
  const context = useContext(ThemePreferenceContext)
  if (!context) {
    throw new Error('useThemePreference must be used within ThemePreferenceProvider')
  }
  return context
}
