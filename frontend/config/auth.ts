/**
 * Bartcash — Auth Service
 *
 * Connects to the Bartcash Laravel backend authentication endpoints.
 *
 * Endpoints covered:
 *   POST /auth/register
 *   POST /auth/verify-otp
 *   POST /auth/resend-otp
 *   POST /auth/login
 *   POST /auth/refresh
 *   POST /auth/logout
 *   POST /auth/forgot-password
 *   POST /auth/reset-password
 *
 * Token storage:
 *   access_token  → stored in memory (module-level variable)
 *   refresh_token → stored in AsyncStorage (persists across app restarts)
 *
 * NOTE: Phone-based 2FA OTP on login is temporarily disabled.
 * The OTP flow only applies to email verification after registration.
 */

import api from "./api";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Storage Keys ─────────────────────────────────────────────────────────────
const REFRESH_TOKEN_KEY = "bartcash_refresh_token";
const USER_KEY = "bartcash_user";

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

// ─── Types ────────────────────────────────────────────────────────────────────

export type RegisterPayload = {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  password_confirmation: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type VerifyOtpPayload = {
  email: string;
  otp: string;
};

export type ResendOtpPayload = {
  email: string;
};

export type ForgotPasswordPayload = {
  email: string;
};

export type ResetPasswordPayload = {
  token: string;
  password: string;
  password_confirmation: string;
};

export type AuthUser = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  profile_photo: string | null;
  average_rating: string;
};

export type ApiResponse<T = void> = {
  success: boolean;
  message: string;
  data?: T;
};

// ─── Register ─────────────────────────────────────────────────────────────────
/**
 * POST /auth/register
 * Creates a new account and triggers an OTP email.
 * On success, navigate to OTP verification screen passing the email.
 */
export async function register(
  payload: RegisterPayload,
): Promise<ApiResponse<{ user_id: string; email: string }>> {
  const response = await api.post("/auth/register", payload);
  return response.data;
}

// ─── Verify OTP ───────────────────────────────────────────────────────────────
/**
 * POST /auth/verify-otp
 * Verifies the 6-digit OTP sent to the user's email after registration.
 * On success, navigate to Login screen.
 */
export async function verifyOtp(
  payload: VerifyOtpPayload,
): Promise<ApiResponse> {
  const response = await api.post("/auth/verify-otp", payload);
  return response.data;
}

// ─── Resend OTP ───────────────────────────────────────────────────────────────
/**
 * POST /auth/resend-otp
 * Resends the OTP email. Rate limited to 3 requests per 30 minutes.
 */
export async function resendOtp(
  payload: ResendOtpPayload,
): Promise<ApiResponse> {
  const response = await api.post("/auth/resend-otp", payload);
  return response.data;
}

// ─── Login ────────────────────────────────────────────────────────────────────
/**
 * POST /auth/login
 * Authenticates user and returns JWT access token + refresh token.
 * Stores refresh token in AsyncStorage, access token in memory.
 * On success, navigate directly to Home — no OTP step.
 *
 * NOTE: Phone 2FA is temporarily disabled. Login goes straight through.
 */
export async function login(
  payload: LoginPayload,
): Promise<
  ApiResponse<{ access_token: string; refresh_token: string; user: AuthUser }>
> {
  const response = await api.post("/auth/login", payload);

  if (response.data?.data?.access_token) {
    _accessToken = response.data.data.access_token;
    await AsyncStorage.setItem(
      REFRESH_TOKEN_KEY,
      response.data.data.refresh_token,
    );
    await AsyncStorage.setItem(
      USER_KEY,
      JSON.stringify(response.data.data.user),
    );
  }

  return response.data;
}

// ─── Refresh Token ────────────────────────────────────────────────────────────
/**
 * POST /auth/refresh
 * Exchanges the stored refresh token for a new access + refresh token pair.
 * Called automatically by the API interceptor when a 401 is received.
 * Also called on app start to restore the session.
 */
export async function refreshTokens(): Promise<boolean> {
  try {
    const storedRefreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
    if (!storedRefreshToken) return false;

    const response = await api.post("/auth/refresh", {
      refresh_token: storedRefreshToken,
    });

    if (response.data?.data?.access_token) {
      _accessToken = response.data.data.access_token;
      await AsyncStorage.setItem(
        REFRESH_TOKEN_KEY,
        response.data.data.refresh_token,
      );
      return true;
    }

    return false;
  } catch {
    // Refresh token expired or revoked — session is dead
    await clearSession();
    return false;
  }
}

// ─── Logout ───────────────────────────────────────────────────────────────────
/**
 * POST /auth/logout
 * Revokes the refresh token on the server.
 * Clears all local tokens regardless of API outcome.
 */
export async function logout(): Promise<void> {
  try {
    const storedRefreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
    if (storedRefreshToken) {
      await api.post("/auth/logout", {
        refresh_token: storedRefreshToken,
      });
    }
  } catch {
    // Always clear locally even if server call fails
  } finally {
    await clearSession();
  }
}

// ─── Forgot Password ──────────────────────────────────────────────────────────
/**
 * POST /auth/forgot-password
 * Sends a password reset deep link to the user's email.
 * Always returns generic success — never reveals account existence.
 */
export async function forgotPassword(
  payload: ForgotPasswordPayload,
): Promise<ApiResponse> {
  const response = await api.post("/auth/forgot-password", payload);
  return response.data;
}

// ─── Reset Password ───────────────────────────────────────────────────────────
/**
 * POST /auth/reset-password
 * Resets the user's password using the token from the deep link email.
 * Revokes all active sessions on success.
 */
export async function resetPassword(
  payload: ResetPasswordPayload,
): Promise<ApiResponse> {
  const response = await api.post("/auth/reset-password", payload);
  return response.data;
}

// ─── Session Helpers ──────────────────────────────────────────────────────────

/**
 * Clears all local auth state.
 * Called on logout or when refresh token is expired/revoked.
 */
export async function clearSession(): Promise<void> {
  _accessToken = null;
  await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
  await AsyncStorage.removeItem(USER_KEY);
}

/**
 * Returns the stored user object from AsyncStorage.
 * Used to restore user state on app start.
 */
export async function getStoredUser(): Promise<AuthUser | null> {
  try {
    const raw = await AsyncStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Checks if a session exists locally.
 * Used by the Splash screen to decide where to navigate.
 */
export async function hasSession(): Promise<boolean> {
  const token = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
  return token !== null;
}
