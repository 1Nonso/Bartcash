/**
 * useAuthTheme
 * Returns color tokens and statusBar style based on device color scheme.
 * Import this in every auth screen instead of hardcoding colors.
 */

import { useColorScheme } from "react-native";
import { Colors } from "@/constants/colors";

export function useAuthTheme() {
  const scheme = useColorScheme(); // "light" | "dark" | null
  const isDark = scheme === "dark";

  return {
    isDark,
    statusBarStyle: isDark ? ("light" as const) : ("dark" as const),

    // Backgrounds
    bg: isDark ? Colors.primary : Colors.white,
    surface: isDark ? "#2A2831" : Colors.surface,
    surfaceVariant: isDark ? "#332F3E" : Colors.surfaceVariant,

    // Text
    textPrimary: isDark ? Colors.text.inverse : Colors.text.primary,
    textSecondary: isDark ? Colors.gray[400] : Colors.text.secondary,
    textMuted: isDark ? Colors.gray[500] : Colors.text.tertiary,
    textPlaceholder: isDark ? Colors.gray[600] : Colors.text.placeholder,
    textDisabled: isDark ? Colors.gray[600] : Colors.text.disabled,

    // Borders
    borderDefault: isDark ? "#3D3847" : Colors.border.default,
    borderFocus: isDark ? Colors.text.inverse : Colors.border.focus,
    borderSubtle: isDark ? "#2E2A38" : Colors.border.subtle,

    // Input
    inputBg: isDark ? "#2A2831" : Colors.surfaceVariant,
    inputBgFocused: isDark ? "#332F3E" : Colors.white,
    inputBgError: isDark ? "#2D1A1A" : "#FFF8F8",

    // Button
    btnPrimary: isDark ? Colors.white : Colors.primary,
    btnPrimaryText: isDark ? Colors.primary : Colors.white,
    btnDisabled: isDark ? Colors.gray[700] : Colors.gray[300],
    btnDisabledText: isDark ? Colors.gray[500] : Colors.white,

    // Card
    cardBorder: isDark ? "#3D3847" : Colors.border.default,

    // Semantic
    error: Colors.danger,
    errorBg: isDark ? "#2D1A1A" : Colors.dangerLight,
    success: Colors.success,
    link: isDark ? "#A78BFA" : Colors.text.link,
  };
}
