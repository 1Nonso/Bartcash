/**
 * <Redirect> for the flag-gated tab screens (Home, Discover, Browse).
 *
 * On a full reload a screen's effects run before the root navigator has
 * finished mounting, and <Redirect> replaces at once, which logs "Can't
 * perform a React state update on a component that hasn't mounted yet"
 * (expo-router ContextNavigator). This waits one tick, so the navigator is
 * mounted, and shows the screen background meanwhile.
 */

import React, { useCallback } from "react";
import { View } from "react-native";
import { router, useFocusEffect, type Href } from "expo-router";
import { useAuthTheme } from "@/constants/useAuthTheme";

export function SafeRedirect({ href }: { href: Href }) {
  const theme = useAuthTheme();
  useFocusEffect(
    useCallback(() => {
      const t = setTimeout(() => router.replace(href), 0);
      return () => clearTimeout(t);
    }, [href]),
  );
  return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
}
