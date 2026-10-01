import { useEffect, useState } from "react";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "expo-router/react-navigation";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator } from "react-native";
import "react-native-reanimated";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import Toast from "react-native-toast-message";
import { isExpo } from "@/config/notifications";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { hasSession, refreshTokens } from "@/config/auth";
import { registerForPushNotifications } from "@/config/notifications";
import { Colors } from "@/constants";

SplashScreen.preventAutoHideAsync();

function navigateFromNotification(data: any) {
  const referenceType = data?.reference_type;
  const referenceId = data?.reference_id;
  if (!referenceType || !referenceId) return;

  if (referenceType === "Trade") {
    router.push({
      pathname: "/(support-pages)/trade/[id]",
      params: { id: referenceId },
    });
  } else if (referenceType === "Dispute") {
    // TODO: point at the dispute detail screen once dispute.tsx exists
    router.push({
      pathname: "/(support-pages)/trade/[id]",
      params: { id: referenceId },
    });
  }
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const sessionExists = await hasSession();
        if (!sessionExists) {
          setAuthed(false);
          return;
        }
        const valid = await refreshTokens();
        setAuthed(valid);
      } catch {
        setAuthed(false);
      } finally {
        setReady(true);
        SplashScreen.hideAsync();
      }
    };

    bootstrap();
  }, []);

  useEffect(() => {
    if (!ready || isExpo) return;
    if (authed) {
      router.replace("/(main-pages)/dashboard");
      registerForPushNotifications();
    } else {
      router.replace("/(auth)/sign-in");
    }
  }, [ready, authed]);

  // Tap on a notification while app is backgrounded/foregrounded
  useEffect(() => {
    if (isExpo) return;
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        navigateFromNotification(response.notification.request.content.data);
      },
    );
    return () => sub.remove();
  }, []);

  // App was fully killed and opened via a notification tap (cold start)
  useEffect(() => {
    if (!ready) return;
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        navigateFromNotification(response.notification.request.content.data);
      }
    });
  }, [ready]);

  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colorScheme === "dark" ? "#000" : "#fff",
        }}
      >
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(main-pages)" options={{ headerShown: false }} />
        <Stack.Screen name="(support-pages)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
      <Toast />
    </ThemeProvider>
  );
}
