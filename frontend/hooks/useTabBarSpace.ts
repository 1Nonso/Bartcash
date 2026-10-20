import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Spacing } from "@/constants";

/** Floating tab bar geometry (app/(main-pages)/_layout.tsx). */
export const TAB_BAR_HEIGHT = 64;
/** Gap between the bar and the bottom safe area. */
export const TAB_BAR_GAP = 12;

/**
 * Bottom padding a tab screen's scroll content needs so its last item is not
 * hidden under the floating tab bar.
 */
export function useTabBarSpace(): number {
  const insets = useSafeAreaInsets();
  return insets.bottom + TAB_BAR_GAP + TAB_BAR_HEIGHT + Spacing[4];
}
