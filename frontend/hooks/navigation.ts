import { router } from "expo-router";

/**
 * Safe back navigation.
 * If there is a screen in the stack to go back to, go back.
 * Otherwise fall back to the dashboard so the app never crashes.
 */
export function goBack(fallback: string = "/(main-pages)/dashboard") {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback as any);
  }
}
