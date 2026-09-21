/**
 * Bartcash — Axios Instance
 *
 * Handles:
 *  - Base URL from environment variable
 *  - JWT access token injection on every request
 *  - Automatic token refresh when a 401 is received
 *  - Request queuing during token refresh
 *  - Session clearing when refresh token is expired
 */

import axios, { InternalAxiosRequestConfig } from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getAccessToken,
  setAccessToken,
  refreshTokens,
  clearSession,
} from "./auth";

// ─── Create Instance ──────────────────────────────────────────────────────────
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

// ─── Request Interceptor ──────────────────────────────────────────────────────
// Attaches the current access token to every outgoing request.

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
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
  (response) => response,
  async (error) => {
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
        const success = await refreshTokens();

        if (success) {
          const newToken = getAccessToken();
          processQueue(null, newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        } else {
          // Refresh token is dead — clear session
          processQueue(error, null);
          await clearSession();
          return Promise.reject(error);
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        await clearSession();
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
