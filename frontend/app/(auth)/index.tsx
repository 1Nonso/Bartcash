import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated, Easing, TouchableOpacity } from "react-native";
import { useAnimatedValue } from "@/hooks/useAnimatedValue";
import { router } from "expo-router";
import { Image } from "expo-image";
import * as SplashScreen from "expo-splash-screen";
import { useAuthTheme } from "@/constants/useAuthTheme";
import { Colors, Spacing, Typography } from "@/constants";
import { hasSession } from "@/config/auth";
import { refreshSession } from "@/config/api";
import { wakeServer } from "@/config/serverWake";
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

type Destination = "dashboard" | "onboarding" | "sign-in" | "unreachable";

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export default function SplashScreenComponent() {
  const theme = useAuthTheme();

  const logoScale = useAnimatedValue(0.6);
  const logoOpacity = useAnimatedValue(0);
  const taglineOpacity = useAnimatedValue(0);
  const ringScale = useAnimatedValue(0.4);
  const ringOpacity = useAnimatedValue(0.6);

  // Free-tier server: "Waking up…" when slow; Try again when unreachable.
  const [note, setNote] = useState<string | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const cancelledRef = useRef(false);

  // Where to go after the splash. Never throws. Wakes the server first (a
  // sleeping Render service takes 30–60 s). A session the server rejects
  // goes to sign-in; one it can't check yet is kept ("unreachable").
  const resolveDestination = useCallback(async (): Promise<Destination> => {
    try {
      const signedIn = await hasSession();
      const awake = await wakeServer({
        onSlow: () => setNote("Waking up the server… this can take up to a minute."),
      });
      if (signedIn) {
        const outcome = await refreshSession();
        if (outcome === "ok") return "dashboard";
        if (outcome === "unreachable" || !awake) return "unreachable";
      }
    } catch {
      // fall through to the signed-out routes
    }
    return (await shouldShowOnboarding()) ? "onboarding" : "sign-in";
  }, []);

  const go = useCallback((destination: Destination) => {
    if (cancelledRef.current) return;
    if (destination === "unreachable") {
      setNote(null);
      setUnreachable(true);
      return;
    }
    if (destination === "dashboard") {
      router.replace("/(main-pages)/dashboard");
      if (Notifications) {
        registerForPushNotifications().catch(() => {});
        // App was opened by tapping a notification while it was closed.
        Notifications.getLastNotificationResponseAsync()
          .then((response) => {
            if (response) {
              navigateFromNotification(response.notification.request.content.data);
            }
          })
          .catch(() => {});
      }
    } else if (destination === "onboarding") {
      router.replace("/(auth)/onboarding");
    } else {
      router.replace("/(auth)/sign-in");
    }
  }, []);

  const retry = () => {
    setUnreachable(false);
    resolveDestination().then(go);
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
    cancelledRef.current = false;
    Promise.all([resolveDestination(), wait(SPLASH_MIN_MS)]).then(([destination]) => go(destination));
    return () => {
      cancelledRef.current = true;
    };
  }, [go, logoOpacity, logoScale, resolveDestination, ringOpacity, ringScale, taglineOpacity]);

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

      {(note || unreachable) && (
        <View style={styles.status}>
          <Text style={[styles.statusText, { color: theme.textSecondary }]}>
            {unreachable ? "Can't reach Bartcash right now. Check your connection and try again." : note}
          </Text>
          {unreachable && (
            <TouchableOpacity
              onPress={retry}
              activeOpacity={0.85}
              accessibilityRole="button"
              style={[styles.retryBtn, { backgroundColor: theme.btnPrimary }]}
            >
              <Text style={[styles.retryText, { color: theme.btnPrimaryText }]}>Try again</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <Text style={[styles.footer, { color: theme.textMuted }]}>
        by bartcash inc.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  status: {
    position: "absolute",
    bottom: 96,
    left: Spacing[6],
    right: Spacing[6],
    alignItems: "center",
    gap: Spacing[3],
  },
  statusText: { ...Typography.caption, textAlign: "center" },
  retryBtn: { borderRadius: 999, paddingHorizontal: Spacing[6], paddingVertical: Spacing[3] },
  retryText: { ...Typography.buttonSm },
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
