import { Tabs } from 'expo-router'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { Bell, House, Map, MessageSquare, User } from 'lucide-react-native'
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { RequireSession } from '@/components/auth/require-session'
import { OfflineBanner } from '@/components/ui/OfflineBanner'
import { brand, spacing } from '@/constants/design'
import { useResponsive } from '@/hooks/use-responsive'
import { TAB_BAR_CONTENT_HEIGHT } from '@/lib/layout-parity'
import { radii, tabBarShadow } from '@/lib/ui-styles'
import { useThemedStyles } from '@/hooks/use-themed-styles'

const ICON_SIZE = 22
const TAB_ICON_BOX = 32
const ICON_LABEL_GAP = 7

type TabLucideIcon = typeof House

function TabIcon({
  focused,
  color,
  Icon,
}: {
  focused: boolean
  color: string
  Icon: TabLucideIcon
}) {
  return (
    <View style={styles.iconBox}>
      {focused ? <View style={styles.iconActiveBg} /> : null}
      <Icon color={color} size={ICON_SIZE} strokeWidth={focused ? 2.5 : 2} />
    </View>
  )
}

/** Full-width tab bar fixed to bottom — custom row layout for reliable Android rendering. */
function FixedTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { tabBar, tabBarBorder, isDark, colors } = useThemedStyles()
  const { isSmallPhone } = useResponsive()
  const { width: screenWidth } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 10 : 0)
  const inactiveColor = isDark ? '#94A3B8' : colors.icon
  const activeColor = brand.primary
  const tabCount = state.routes.length
  const tabWidth = screenWidth / tabCount

  return (
    <View
      style={[
        styles.fixedShell,
        tabBarShadow(isDark),
        {
          width: screenWidth,
          backgroundColor: tabBar,
          borderColor: tabBarBorder,
          paddingBottom: bottomInset,
        },
      ]}
    >
      <View style={[styles.tabRow, { width: screenWidth }]}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key]
          const focused = state.index === index
          const color = focused ? activeColor : inactiveColor
          const label = options.title ?? route.name

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            })
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params)
            }
          }

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key })
          }

          const icon =
            options.tabBarIcon?.({
              focused,
              color,
              size: ICON_SIZE,
            }) ?? null

          return (
            <View key={route.key} style={{ width: tabWidth }}>
              <Pressable
                onPress={onPress}
                onLongPress={onLongPress}
                accessibilityRole="button"
                accessibilityState={focused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
                style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
              >
                <View style={styles.tabItem}>
                  {icon}
                  <Text
                    style={[
                      styles.label,
                      {
                        color,
                        fontSize: isSmallPhone ? 10 : 11,
                        fontWeight: focused ? '700' : '600',
                        marginTop: ICON_LABEL_GAP,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {label}
                  </Text>
                </View>
              </Pressable>
            </View>
          )
        })}
      </View>
    </View>
  )
}

export default function TabsLayout() {
  return (
    <RequireSession>
      <OfflineBanner />
      <Tabs
        tabBar={(props) => <FixedTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: TAB_BAR_CONTENT_HEIGHT,
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            elevation: 0,
          },
          tabBarShowLabel: false,
          tabBarHideOnKeyboard: true,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon focused={focused} color={color} Icon={House} />
            ),
          }}
        />
        <Tabs.Screen
          name="chat"
          options={{
            title: 'AI Chat',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon focused={focused} color={color} Icon={MessageSquare} />
            ),
          }}
        />
        <Tabs.Screen
          name="trips"
          options={{
            title: 'Trips',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon focused={focused} color={color} Icon={Map} />
            ),
          }}
        />
        <Tabs.Screen
          name="notifications"
          options={{
            title: 'Alerts',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon focused={focused} color={color} Icon={Bell} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon focused={focused} color={color} Icon={User} />
            ),
          }}
        />
      </Tabs>
    </RequireSession>
  )
}

const styles = StyleSheet.create({
  fixedShell: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderTopWidth: 1,
    overflow: 'hidden',
    elevation: 0,
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: TAB_BAR_CONTENT_HEIGHT,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  tabItem: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  iconBox: {
    width: TAB_ICON_BOX,
    height: TAB_ICON_BOX,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconActiveBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(37, 99, 235, 0.14)',
  },
  label: {
    lineHeight: 14,
    textAlign: 'center',
    width: '100%',
    paddingHorizontal: spacing.xs,
  },
})
