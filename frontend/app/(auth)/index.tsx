import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Easing } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import * as SplashScreen from "expo-splash-screen";
import { useAuthTheme } from "@/constants/useAuthTheme";
import { Colors, Spacing, Typography } from "@/constants";
import { hasSession, refreshTokens } from "@/config/auth";

import darkLogo from "@/assets/images/bartcash-logo-dark.svg";
import lightLogo from "@/assets/images/bartcash-logo-white.svg";

export default function SplashScreenComponent() {
  const theme = useAuthTheme();

  const logoScale = useRef(new Animated.Value(0.6)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0.4)).current;
  const ringOpacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    SplashScreen.hideAsync();

    // Start logo + tagline animation
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 60,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 800,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 700,
        delay: 200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();

    // Pulsing ring animation
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(ringScale, {
            toValue: 1.4,
            duration: 2000,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(ringOpacity, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(ringScale, {
            toValue: 0.4,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(ringOpacity, {
            toValue: 0.6,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ).start();

    // Check session after animation has had time to show
    const timer = setTimeout(checkSession, 3500);
    return () => clearTimeout(timer);
  }, []);

  const checkSession = async () => {
    try {
      const sessionExists = await hasSession();

      if (sessionExists) {
        // A refresh token exists — try to get a fresh access token
        const refreshed = await refreshTokens();

        if (refreshed) {
          // Session restored — go to main app
          router.replace("/(main-pages)/dashboard");
        } else {
          // Refresh token was expired or revoked — go to login
          router.replace("/onboarding");
        }
      } else {
        // No session at all — first time user or logged out
        router.replace("/onboarding");
      }
    } catch {
      // Something went wrong — safe fallback to onboarding
      router.replace("/onboarding");
    }
  };

  const logo = theme.isDark ? lightLogo : darkLogo;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.glowTop, { backgroundColor: Colors.ai }]} />
      <View style={[styles.glowBottom, { backgroundColor: Colors.ai }]} />

      <Animated.View
        style={[
          styles.ring,
          {
            borderColor: Colors.ai,
            transform: [{ scale: ringScale }],
            opacity: ringOpacity,
          },
        ]}
      />

      <Animated.View
        style={[
          styles.logoWrapper,
          { transform: [{ scale: logoScale }], opacity: logoOpacity },
        ]}
      >
        <Image source={logo} style={styles.logoImage} contentFit="contain" />
        <Text style={[styles.logoWordmark, { color: theme.textPrimary }]}>
          Bartcash
        </Text>
      </Animated.View>

      <Animated.Text
        style={[styles.tagline, { opacity: taglineOpacity, color: Colors.ai }]}
      >
        trade · earn · thrive
      </Animated.Text>

      <Text style={[styles.footer, { color: theme.textMuted }]}>
        by bartcash inc.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  glowTop: {
    position: "absolute",
    top: -120,
    width: 340,
    height: 340,
    borderRadius: 170,
    opacity: 0.06,
  },
  glowBottom: {
    position: "absolute",
    bottom: -140,
    width: 260,
    height: 260,
    borderRadius: 130,
    opacity: 0.04,
  },
  ring: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1.5,
  },
  logoWrapper: {
    alignItems: "center",
    gap: Spacing[4],
  },
  logoImage: {
    width: 200,
    height: 100,
  },
  logoWordmark: {
    ...Typography.cardTitleLarge,
    letterSpacing: Spacing[3],
  },
  tagline: {
    marginTop: Spacing[3],
    ...Typography.micro,
    letterSpacing: 4,
    textTransform: "lowercase",
  },
  footer: {
    position: "absolute",
    bottom: Spacing[10],
    ...Typography.micro,
    letterSpacing: 2,
  },
});
