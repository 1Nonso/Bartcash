/**
 * BartCash — BottomTabBar Component
 *
 * Observed in Figma across ALL screens:
 *   [🏠 Home]  [🔍 Search]  [⊕ Sell]  [💬 Inbox]  [👤 Profile]
 *
 * Design details:
 *   - White background with a subtle top border
 *   - Active tab: black icon + black label
 *   - Inactive tab: gray icon + gray label (#757575)
 *   - "Sell" (center): a distinct circular black button (⊕), larger,
 *     no label — it's the elevated CTA tab
 *   - Height: ~60px + safe area inset
 *   - The Sell button is outlined circle (+) icon, black
 *
 * This is a purely presentational component for layout reference.
 * In the actual app, this is handled by expo-router's tab navigator.
 * Use this file as the reference for configuring tabBarStyle in
 * app/(tabs)/_layout.tsx.
 */

import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Colors,
  Typography,
  Spacing,
  Layout,
  Shadows,
  Radius,
} from "@/constants";

type TabName = "home" | "search" | "sell" | "inbox" | "profile";

interface TabBarProps {
  activeTab: TabName;
  onTabPress: (tab: TabName) => void;
  style?: ViewStyle;
}

const TABS: {
  name: TabName;
  label: string;
  icon: string;
  activeIcon: string;
}[] = [
  { name: "home", label: "Home", icon: "⌂", activeIcon: "⌂" },
  { name: "search", label: "Search", icon: "⊙", activeIcon: "⊙" },
  { name: "sell", label: "", icon: "⊕", activeIcon: "⊕" }, // no label per design
  { name: "inbox", label: "Inbox", icon: "💬", activeIcon: "💬" },
  { name: "profile", label: "Profile", icon: "👤", activeIcon: "👤" },
];

export const BottomTabBar: React.FC<TabBarProps> = ({
  activeTab,
  onTabPress,
  style,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: insets.bottom || Spacing[2] },
        style,
      ]}
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.name;
        const isSell = tab.name === "sell";

        if (isSell) {
          return (
            <TouchableOpacity
              key={tab.name}
              style={styles.sellTab}
              onPress={() => onTabPress(tab.name)}
              activeOpacity={0.8}
            >
              <View style={styles.sellCircle}>
                <Text style={styles.sellIcon}>+</Text>
              </View>
            </TouchableOpacity>
          );
        }

        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tab}
            onPress={() => onTabPress(tab.name)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.icon,
                isActive ? styles.iconActive : styles.iconInactive,
              ]}
            >
              {isActive ? tab.activeIcon : tab.icon}
            </Text>
            {tab.label ? (
              <Text
                style={[
                  styles.label,
                  isActive ? styles.labelActive : styles.labelInactive,
                ]}
              >
                {tab.label}
              </Text>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// ─── Expo Router Tab Config Reference ─────────────────────────────────────────
// Use this in app/(tabs)/_layout.tsx:
//
// tabBar: (props) => <BottomTabBar {...props} />
//
// tabBarStyle config (for native expo-router navigator):
export const tabBarStyleConfig = {
  tabBarStyle: {
    backgroundColor: Colors.tabBar.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
    height: Layout.tabBarHeight,
    paddingBottom: 0,
    ...Shadows.xl,
  },
  tabBarActiveTintColor: Colors.tabBar.active,
  tabBarInactiveTintColor: Colors.tabBar.inactive,
  tabBarLabelStyle: {
    ...Typography.tabLabel,
  },
  tabBarShowLabel: true,
} as const;

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.tabBar.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
    height: Layout.tabBarHeight,
    ...Shadows.xl,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    height: "100%",
  },
  icon: {
    fontSize: 22,
  },
  iconActive: {
    color: Colors.tabBar.active,
  },
  iconInactive: {
    color: Colors.tabBar.inactive,
  },
  label: {
    ...Typography.tabLabel,
  },
  labelActive: {
    color: Colors.tabBar.active,
  },
  labelInactive: {
    color: Colors.tabBar.inactive,
  },

  // Sell tab
  sellTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
  },
  sellCircle: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.tabBar.sellButton,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.tabBar.sellButton,
  },
  sellIcon: {
    fontSize: 24,
    color: Colors.tabBar.sellButtonIcon,
    fontWeight: "300",
    lineHeight: 26,
  },
});
