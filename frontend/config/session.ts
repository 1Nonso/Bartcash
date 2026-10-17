/**
 * Bartcash — Session State
 *
 * Token storage shared by the axios instance (api.ts) and the auth service
 * (auth.ts). Kept separate so neither of those imports the other in a cycle.
 *
 *   access_token  → stored in memory (module-level variable)
 *   refresh_token → stored in AsyncStorage (persists across app restarts)
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Storage Keys ─────────────────────────────────────────────────────────────
export const REFRESH_TOKEN_KEY = "bartcash_refresh_token";
export const USER_KEY = "bartcash_user";

// ─── In-memory access token ───────────────────────────────────────────────────
// Access token is kept in memory only — never persisted to AsyncStorage.
// It is re-issued on app start via the refresh token.
let _accessToken: string | null = null;

export function getAccessToken(): string | null {
  return _accessToken;
}

export function setAccessToken(token: string | null): void {
  _accessToken = token;
}

/**
 * Clears all local auth state.
 * Called on logout or when refresh token is expired/revoked.
 */
export async function clearSession(): Promise<void> {
  _accessToken = null;
  await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
  await AsyncStorage.removeItem(USER_KEY);
}
