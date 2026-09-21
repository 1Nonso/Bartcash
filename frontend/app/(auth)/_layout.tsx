import { useColorScheme , StyleSheet, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Colors } from "@/constants/colors";

/**
 * BartCash — (auth) Route Group Layout
 *
 * Screens covered:
 *  - index             → Splash Screen
 *  - onboarding        → 3-slide value proposition
 *  - sign-in           → Sign In
 *  - sign-up           → Sign Up
 *  - forgot-password   → Forgot Password
 *  - otp-verification  → OTP (email & phone)
 *  - reset-password    → Reset Password
 */

export default function AuthLayout() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  const bg = isDark ? Colors.primary : Colors.white;

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      {/*
        style="auto" lets the OS decide icon color based on bg.
        On a light bg → dark icons. On a dark bg → light icons.
        This is the correct way to handle theme-responsive status bars.
      */}
      <StatusBar style="auto" backgroundColor={bg} translucent={false} />

      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: bg },
          animation: "fade",
          animationDuration: 220,
          gestureEnabled: false,
        }}
      >
        <Stack.Screen name="index" options={{ animation: "none" }} />
        <Stack.Screen
          name="onboarding"
          options={{ animation: "fade", gestureEnabled: false }}
        />
        <Stack.Screen
          name="sign-in"
          options={{ animation: "slide_from_right", gestureEnabled: true }}
        />
        <Stack.Screen
          name="sign-up"
          options={{ animation: "slide_from_right", gestureEnabled: true }}
        />
        <Stack.Screen
          name="forgot-password"
          options={{ animation: "slide_from_bottom", gestureEnabled: true }}
        />
        <Stack.Screen
          name="otp-verification"
          options={{ animation: "slide_from_bottom", gestureEnabled: false }}
        />
        <Stack.Screen
          name="reset-password"
          options={{ animation: "slide_from_bottom", gestureEnabled: false }}
        />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
