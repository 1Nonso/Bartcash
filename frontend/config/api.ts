/**
 * Bartcash — Axios Instance
 *
 * Handles:
 *  - Base URL from environment variable
 *  - JWT access token injection on every request
 *  - Automatic token refresh when a 401 is received
 *  - Request queuing during token refresh
 *  - Session clearing when refresh token is expired
 *  - Waking the free-tier server after a long idle (config/serverWake.ts)
 */

import axios, { InternalAxiosRequestConfig } from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  REFRESH_TOKEN_KEY,
  getAccessToken,
  setAccessToken,
  clearSession,
} from "./session";
import { noteServerContact, serverMayBeAsleep, wakeServer } from "./serverWake";

// ─── Create Instance ──────────────────────────────────────────────────────────
// axios.create is the documented factory; the default-member rule is a false
// positive here.
// eslint-disable-next-line import/no-named-as-default-member
const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// ─── Refresh Lock ─────────────────────────────────────────────────────────────
// Prevents multiple simultaneous refresh calls when several requests
// fail with 401 at the same time. All failed requests queue up and
// retry together once the refresh completes.

let isRefreshing = false;
let failedQueue: {
  resolve: (token: string) => void;
  reject: (error: any) => void;
}[] = [];

function processQueue(error: any, token: string | null = null) {
  failedQueue.forEach((request) => {
    if (error) {
      request.reject(error);
    } else {
      request.resolve(token!);
    }
  });
  failedQueue = [];
}

// ─── Refresh Token ────────────────────────────────────────────────────────────
/**
 * POST /auth/refresh
 * Exchanges the stored refresh token for a new access + refresh token pair.
 * Called automatically by the response interceptor when a 401 is received.
 * Also called on app start to restore the session (re-exported by auth.ts).
 * Lives here, not in auth.ts, so api.ts never imports auth.ts.
 */
export type RefreshOutcome = "ok" | "invalid" | "unreachable";

/**
 * "invalid": the server rejected the refresh token (expired or revoked), so
 * the session is cleared. "unreachable": no answer (asleep, offline, 5xx);
 * the session is kept so the next try can restore it.
 */
export async function refreshSession(): Promise<RefreshOutcome> {
  try {
    const storedRefreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
    if (!storedRefreshToken) return "invalid";

    const response = await api.post("/auth/refresh", {
      refresh_token: storedRefreshToken,
    });

    if (response.data?.data?.access_token) {
      setAccessToken(response.data.data.access_token);
      await AsyncStorage.setItem(
        REFRESH_TOKEN_KEY,
        response.data.data.refresh_token,
      );
      return "ok";
    }
    return "unreachable";
  } catch (err: any) {
    const status = err?.response?.status;
    if (status === 400 || status === 401 || status === 403) {
      // Refresh token expired or revoked — session is dead
      await clearSession();
      return "invalid";
    }
    return "unreachable";
  }
}

export async function refreshTokens(): Promise<boolean> {
  return (await refreshSession()) === "ok";
}

// ─── Request Interceptor ──────────────────────────────────────────────────────
// Attaches the current access token to every outgoing request.

api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // After a long idle the free-tier server may be asleep: wake it first
    // (shared with any wake-up already running) so this request doesn't
    // time out. If it can't be woken, the request still goes and fails as usual.
    if (serverMayBeAsleep()) await wakeServer();
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ─── Response Interceptor ─────────────────────────────────────────────────────
// On 401 — attempt to refresh tokens. If refresh succeeds, retry the
// original request with the new access token. If refresh fails,
// clear the session and let the app redirect to login.

api.interceptors.response.use(
  (response) => {
    noteServerContact();
    return response;
  },
  async (error) => {
    if (error.response) noteServerContact();
    const originalRequest = error.config;

    // Only attempt refresh on 401 and only once per request
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Skip refresh for auth endpoints themselves to avoid infinite loops
      const isAuthEndpoint =
        originalRequest.url?.includes("/auth/login") ||
        originalRequest.url?.includes("/auth/register") ||
        originalRequest.url?.includes("/auth/refresh");

      if (isAuthEndpoint) {
        return Promise.reject(error);
      }

      // If already refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      // Start refresh
      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const outcome = await refreshSession();

        if (outcome === "ok") {
          const newToken = getAccessToken();
          processQueue(null, newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        }
        // "invalid" already cleared the session; "unreachable" keeps it
        // so a slow or sleeping server never signs the user out.
        processQueue(error, null);
        return Promise.reject(error);
      } catch (refreshError) {
        processQueue(refreshError, null);
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Log server errors for debugging
    if (error.response?.status === 500) {
      console.error("[API] Server error:", error.response?.data);
    }

    if (!error.response) {
      console.error("[API] Network error — server unreachable");
    }

    return Promise.reject(error);
  },
);

export default api;
