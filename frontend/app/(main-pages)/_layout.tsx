import React from "react";
import { Tabs, router } from "expo-router";
import { View, Text, StyleSheet, TouchableOpacity, type ColorValue } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuthTheme } from "@/constants/useAuthTheme";
import { Colors, Spacing } from "@/constants";
import type { BottomTabBarButtonProps } from "expo-router/js-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFeatures } from "@/hooks/useFeatures";
import { TAB_BAR_GAP, TAB_BAR_HEIGHT } from "@/hooks/useTabBarSpace";

type Theme = ReturnType<typeof useAuthTheme>;

// ─── Glass background ────────────────────────────────────────────────────────
// Simulated "liquid glass": a translucent fill, a bright hairline border and
// a faint highlight along the top edge. No native blur (Android-first; see
// the Oct 20 decision). Swap this one component for expo-blur to get a real
// blur later.
function GlassBackground({ theme }: { theme: Theme }) {
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        styles.glass,
        { backgroundColor: theme.glassBg, borderColor: theme.glassBorder },
      ]}
    >
      <View style={[styles.glassHighlight, { backgroundColor: theme.glassHighlight }]} />
    </View>
  );
}

// ─── Tab icon with an active pill ────────────────────────────────────────────
function TabIcon({
  name,
  focused,
  color,
  theme,
}: {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  color: ColorValue;
  theme: Theme;
}) {
  return (
    <View
      style={[
        styles.iconPill,
        focused && { backgroundColor: theme.glassActive },
      ]}
    >
      <Ionicons name={name} size={22} color={color} />
    </View>
  );
}

// ─── Sell Button — raised centre tab ─────────────────────────────────────────
function SellTabButton({
  props,
  theme,
}: {
  props: BottomTabBarButtonProps;
  theme: Theme;
}) {
  const circleBackground = theme.isDark ? Colors.white : Colors.primary;
  const iconColor = theme.isDark ? Colors.primary : Colors.white;

  return (
    <TouchableOpacity
      onPress={props.onPress}
      activeOpacity={0.85}
      style={styles.sellWrapper}
      accessibilityRole="button"
      accessibilityLabel="Sell"
    >
      <View
        style={[
          styles.sellCircle,
          { backgroundColor: circleBackground, borderColor: theme.glassBorder },
        ]}
      >
        <Ionicons name="add" size={28} color={iconColor} />
      </View>
      <Text style={[styles.sellLabel, { color: theme.textMuted }]}>Sell</Text>
    </TouchableOpacity>
  );
}

// ─── Main Layout ──────────────────────────────────────────────────────────────
export default function TabLayout() {
  const theme = useAuthTheme();
  const insets = useSafeAreaInsets();
  // Flag on (UI spec §13.3): Home and Discover replace Home / Browse and
  // Search, which stay registered (hidden) so the flag off restores them.
  const { qloo } = useFeatures();

  const icon = (on: keyof typeof Ionicons.glyphMap, off: keyof typeof Ionicons.glyphMap) => {
    const TabBarIcon = ({ focused, color }: { focused: boolean; color: ColorValue }) => (
      <TabIcon name={focused ? on : off} focused={focused} color={color} theme={theme} />
    );
    return TabBarIcon;
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Floating pill: content scrolls underneath (screens pad with
        // useTabBarSpace()).
        tabBarStyle: {
          position: "absolute",
          left: Spacing[4],
          right: Spacing[4],
          bottom: insets.bottom + TAB_BAR_GAP,
          height: TAB_BAR_HEIGHT,
          paddingTop: Spacing[1.5],
          paddingBottom: Spacing[1.5],
          borderRadius: TAB_BAR_HEIGHT / 2,
          borderTopWidth: 0,
          backgroundColor: "transparent",
          elevation: 0,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: theme.isDark ? 0.4 : 0.12,
          shadowRadius: 20,
        },
        tabBarBackground: () => <GlassBackground theme={theme} />,
        tabBarActiveTintColor: theme.isDark ? Colors.white : Colors.primary,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarItemStyle: styles.item,
        tabBarLabelStyle: styles.label,
      }}
    >
      {/* Tabs go Back to the first declared route, so the flag-off Home
          (Browse) comes first; with the flag on it redirects to Home. */}
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Home",
          href: qloo ? null : undefined,
          tabBarIcon: icon("home", "home-outline"),
        }}
      />
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          href: qloo ? undefined : null,
          tabBarIcon: icon("home", "home-outline"),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: "Discover",
          href: qloo ? undefined : null,
          tabBarIcon: icon("compass", "compass-outline"),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          href: qloo ? null : undefined,
          tabBarIcon: icon("search", "search-outline"),
        }}
      />
      <Tabs.Screen
        name="sell"
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.push("/(support-pages)/listing/create");
          },
        }}
        options={{
          title: "",
          tabBarButton: (props) => <SellTabButton props={props} theme={theme} />,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: "Inbox",
          tabBarIcon: icon("chatbubbles", "chatbubbles-outline"),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: icon("person", "person-outline"),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  glass: {
    borderRadius: TAB_BAR_HEIGHT / 2,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: "hidden",
  },
  glassHighlight: {
    position: "absolute",
    top: 0,
    left: TAB_BAR_HEIGHT / 2,
    right: TAB_BAR_HEIGHT / 2,
    height: 1,
  },
  item: {
    paddingVertical: 0,
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 0,
  },
  iconPill: {
    minWidth: 44,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing[2],
  },
  sellWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 2,
  },
  sellCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginTop: -22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  sellLabel: {
    fontSize: 10,
    fontWeight: "600",
  },
});
