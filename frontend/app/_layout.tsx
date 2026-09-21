import { useEffect, useState } from "react";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator } from "react-native";
import "react-native-reanimated";
import * as SplashScreen from "expo-splash-screen";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { hasSession, refreshTokens } from "@/config/auth";
import { Colors } from "@/constants";

SplashScreen.preventAutoHideAsync();

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
    if (!ready) return;
    if (authed) {
      router.replace("/(main-pages)/dashboard");
    } else {
      router.replace("/(auth)/sign-in");
    }
  }, [ready, authed]);

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
    </ThemeProvider>
  );
}
