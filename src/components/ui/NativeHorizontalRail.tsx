import React, { Children, isValidElement, type ReactNode } from 'react'
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'

import { spacing } from '@/constants/design'
import { horizontalRailContentStyle, horizontalRailItemStyle } from '@/lib/layout-native'

interface Props {
  width: number
  height: number
  children: ReactNode
  contentStyle?: StyleProp<ViewStyle>
}

export function NativeHorizontalRail({ width, height, children, contentStyle }: Props) {
  const items = Children.toArray(children).filter(isValidElement)

  return (
    <View style={[styles.shell, { width, height }]} collapsable={false}>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        overScrollMode="never"
        style={{ width, height }}
        contentContainerStyle={[
          horizontalRailContentStyle({ height, paddingRight: spacing.md }),
          contentStyle,
        ]}
      >
        {items.map((child, index) => (
          <View
            key={String(child.key ?? index)}
            style={[horizontalRailItemStyle(), styles.itemGap]}
            collapsable={false}
          >
            {child}
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  shell: {
    marginBottom: spacing.lg,
    flexGrow: 0,
    flexShrink: 0,
  },
  itemGap: {
    marginRight: spacing.md,
  },
})

export default NativeHorizontalRail
