import { Tabs } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuthTheme } from "@/constants/useAuthTheme";
import { Colors, Spacing } from "@/constants";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Sell Button — elevated center tab ───────────────────────────────────────
function SellTabButton({
  props,
  theme,
}: {
  props: BottomTabBarButtonProps;
  theme: ReturnType<typeof useAuthTheme>;
}) {
  const circleBackground = theme.isDark ? Colors.white : Colors.primary;
  const iconColor = theme.isDark ? Colors.primary : Colors.white;

  return (
    <TouchableOpacity
      onPress={props.onPress}
      activeOpacity={0.85}
      style={styles.sellWrapper}
    >
      <View style={[styles.sellCircle, { backgroundColor: circleBackground }]}>
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

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.borderSubtle,
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 84 : 65 + insets.bottom,
          paddingBottom: Platform.OS === "ios" ? 24 : insets.bottom + 10,
          paddingTop: Spacing[2],
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "500",
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Home",
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? "search" : "search-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="sell"
        options={{
          title: "",
          tabBarButton: (props) => (
            <SellTabButton props={props} theme={theme} />
          ),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: "Inbox",
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? "chatbubbles" : "chatbubbles-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? "person" : "person-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sellWrapper: {
    alignItems: "center",
    justifyContent: "flex-end",
    flex: 1,
    gap: 2,
  },
  sellCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  sellLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
});
