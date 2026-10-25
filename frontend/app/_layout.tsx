import { useEffect } from "react";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "expo-router/react-navigation";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import * as SplashScreen from "expo-splash-screen";
import Toast from "react-native-toast-message";
import {
  Notifications,
  navigateFromNotification,
} from "@/config/notifications";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { GestureHandlerRootView } from "react-native-gesture-handler";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  // Session check and routing live in the animated splash, (auth)/index,
  // which also hides the native splash. This layout only renders the stack.

  // Tap on a notification while the app is running or backgrounded.
  // Push notifications are not available in Expo Go.
  useEffect(() => {
    if (!Notifications) return;
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        navigateFromNotification(response.notification.request.content.data);
      },
    );
    return () => sub.remove();
  }, []);

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Stack>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(main-pages)" options={{ headerShown: false }} />
          <Stack.Screen
            name="(support-pages)"
            options={{ headerShown: false }}
          />
        </Stack>
        <StatusBar style="auto" />
        <Toast />
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}
