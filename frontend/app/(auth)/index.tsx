import { useEffect } from "react";
import { View, Text, StyleSheet, Animated, Easing, useAnimatedValue } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import * as SplashScreen from "expo-splash-screen";
import { useAuthTheme } from "@/constants/useAuthTheme";
import { Colors, Spacing, Typography } from "@/constants";
import { hasSession, refreshTokens } from "@/config/auth";
import {
  Notifications,
  navigateFromNotification,
  registerForPushNotifications,
} from "@/config/notifications";
import { shouldShowOnboarding } from "@/config/onboarding";

import darkLogo from "@/assets/images/bartcash-logo-dark.svg";
import lightLogo from "@/assets/images/bartcash-logo-white.svg";

/** Minimum time the splash stays up, so the animation can be seen. */
const SPLASH_MIN_MS = 6000;

type Destination = "dashboard" | "onboarding" | "sign-in";

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export default function SplashScreenComponent() {
  const theme = useAuthTheme();

  const logoScale = useAnimatedValue(0.6);
  const logoOpacity = useAnimatedValue(0);
  const taglineOpacity = useAnimatedValue(0);
  const ringScale = useAnimatedValue(0.4);
  const ringOpacity = useAnimatedValue(0.6);

  // Where to go after the splash. Never throws; falls back to sign-in or
  // onboarding when the session can't be restored.
  const resolveDestination = async (): Promise<Destination> => {
    try {
      if ((await hasSession()) && (await refreshTokens())) return "dashboard";
    } catch {
      // fall through to the signed-out routes
    }
    return (await shouldShowOnboarding()) ? "onboarding" : "sign-in";
  };

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

    // Check the session while the animation plays; leave once both the
    // check and the minimum display time are done.
    let cancelled = false;
    Promise.all([resolveDestination(), wait(SPLASH_MIN_MS)]).then(
      ([destination]) => {
        if (cancelled) return;
        if (destination === "dashboard") {
          router.replace("/(main-pages)/dashboard");
          if (Notifications) {
            registerForPushNotifications().catch(() => {});
            // App was opened by tapping a notification while it was closed.
            Notifications.getLastNotificationResponseAsync()
              .then((response) => {
                if (response) {
                  navigateFromNotification(
                    response.notification.request.content.data,
                  );
                }
              })
              .catch(() => {});
          }
        } else if (destination === "onboarding") {
          router.replace("/(auth)/onboarding");
        } else {
          router.replace("/(auth)/sign-in");
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [logoOpacity, logoScale, ringOpacity, ringScale, taglineOpacity]);

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
