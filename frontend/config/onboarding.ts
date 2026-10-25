import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Bartcash — when signed-out users see onboarding.
 *
 * First launch, then again once ONBOARDING_REPEAT_MS has passed since they
 * last finished or skipped it. Signed-in users never see it (the splash
 * sends them to the dashboard first).
 */

const ONBOARDING_SEEN_AT_KEY = "bartcash_onboarding_seen_at";
export const ONBOARDING_REPEAT_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function shouldShowOnboarding(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(ONBOARDING_SEEN_AT_KEY);
    const seenAt = raw ? Number(raw) : NaN;
    if (!Number.isFinite(seenAt)) return true;
    return Date.now() - seenAt >= ONBOARDING_REPEAT_MS;
  } catch {
    return true;
  }
}

/** Call when the user finishes or skips onboarding. Never throws. */
export async function markOnboardingSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_SEEN_AT_KEY, String(Date.now()));
  } catch {
    // Not critical: worst case they see onboarding again next launch.
  }
}
