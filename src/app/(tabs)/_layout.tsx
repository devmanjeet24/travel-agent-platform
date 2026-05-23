import { Tabs } from 'expo-router'
import { Bell, House, Map, MessageSquare, User } from 'lucide-react-native'
import { Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { RequireSession } from '@/components/auth/require-session'
import { brand } from '@/constants/design'
import { useResponsive } from '@/hooks/use-responsive'
import { isWeb, radii } from '@/lib/ui-styles'
import { useThemedStyles } from '@/hooks/use-themed-styles'

export default function TabsLayout() {
  const { tabBar, tabBarBorder, colors } = useThemedStyles()
  const { width, isSmallPhone } = useResponsive()
  const insets = useSafeAreaInsets()

  const nativeTabHeight = 56 + (isSmallPhone ? 0 : 2)
  const nativePadBottom = Math.max(insets.bottom, Platform.OS === 'android' ? 10 : 8)

  const tabBarStyle = isWeb
    ? {
        position: 'absolute' as const,
        bottom: Math.max(insets.bottom, 16),
        left: Math.max((width - Math.min(width * 0.92, 560)) / 2, 12),
        width: Math.min(width * 0.92, 560),
        backgroundColor: tabBar,
        borderRadius: radii.pill,
        borderTopWidth: 0,
        borderWidth: 1,
        borderColor: tabBarBorder,
        height: 62,
        paddingBottom: 8,
        paddingTop: 8,
        ...Platform.select({
          web: {
            boxShadow: '0 8px 32px rgba(14, 165, 233, 0.18)',
          },
          default: {},
        }),
      }
    : {
        backgroundColor: tabBar,
        borderTopColor: tabBarBorder,
        borderTopWidth: 1,
        height: nativeTabHeight + nativePadBottom,
        paddingBottom: nativePadBottom,
        paddingTop: 8,
        elevation: 8,
      }

  return (
    <RequireSession>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle,
          tabBarActiveTintColor: brand.primaryDark,
          tabBarInactiveTintColor: colors.icon,
          tabBarHideOnKeyboard: true,
          tabBarLabelStyle: {
            fontSize: isSmallPhone ? 10 : 11,
            fontWeight: '600',
            marginBottom: Platform.OS === 'ios' ? 0 : 2,
          },
          tabBarIconStyle: {
            marginTop: 4,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => <House color={color} size={size - 1} strokeWidth={2} />,
          }}
        />
        <Tabs.Screen
          name="chat"
          options={{
            title: 'AI Chat',
            tabBarIcon: ({ color, size }) => (
              <MessageSquare color={color} size={size - 1} strokeWidth={2} />
            ),
          }}
        />
        <Tabs.Screen
          name="trips"
          options={{
            title: 'Trips',
            tabBarIcon: ({ color, size }) => <Map color={color} size={size - 1} strokeWidth={2} />,
          }}
        />
        <Tabs.Screen
          name="notifications"
          options={{
            title: 'Alerts',
            tabBarIcon: ({ color, size }) => <Bell color={color} size={size - 1} strokeWidth={2} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => <User color={color} size={size - 1} strokeWidth={2} />,
          }}
        />
      </Tabs>
    </RequireSession>
  )
}
