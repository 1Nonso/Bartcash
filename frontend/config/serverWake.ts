/**
 * Waking the API on Render's free tier.
 *
 * A free Render service sleeps after 15 minutes without requests, and the
 * first request after that takes 30–60 s, well past the API client's 10 s
 * timeout. So:
 *   - the splash calls wakeServer() before restoring the session;
 *   - api.ts waits for wakeServer() before any request sent after
 *     IDLE_BEFORE_WAKE_MS without contact (the server may have slept).
 * Wake-ups are shared: callers during a wake-up wait for the same one.
 *
 * Uses plain axios (not the api instance) so no interceptors or tokens.
 */

import axios from "axios";

const BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? "";
/** `/health` sits at the server root, not under /api. */
const HEALTH_URL = `${BASE.replace(/\/+$/, "").replace(/\/api$/, "")}/health`;

/** Render sleeps after 15 min; wake first a little before that. */
export const IDLE_BEFORE_WAKE_MS = 14 * 60 * 1000;
/** Longest a wake-up waits (a cold start took 58 s on Oct 25). */
export const WAKE_MAX_MS = 90_000;
/** When the splash starts saying "Waking up the server…". */
export const WAKE_SLOW_AFTER_MS = 3000;
const ATTEMPT_TIMEOUT_MS = 20_000;
const RETRY_GAP_MS = 2000;

let lastContactAt = 0;
let waking: Promise<boolean> | null = null;

/** Any response from the server (success or error) means it is awake. */
export function noteServerContact(now = Date.now()): void {
  lastContactAt = now;
}

export function serverMayBeAsleep(now = Date.now()): boolean {
  return now - lastContactAt > IDLE_BEFORE_WAKE_MS;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function pingUntilAwake(maxMs: number): Promise<boolean> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      await axios.get(HEALTH_URL, {
        timeout: Math.min(ATTEMPT_TIMEOUT_MS, Math.max(1000, deadline - Date.now())),
      });
      noteServerContact();
      return true;
    } catch {
      // Asleep (timeout), starting up (502/503) or offline: try again.
      if (Date.now() + RETRY_GAP_MS >= deadline) break;
      await sleep(RETRY_GAP_MS);
    }
  }
  return false;
}

/**
 * Resolves true once GET /health answers, false after `maxMs`. `onSlow` runs
 * once if it hasn't answered within WAKE_SLOW_AFTER_MS (for a message).
 */
export async function wakeServer(
  { maxMs = WAKE_MAX_MS, onSlow }: { maxMs?: number; onSlow?: () => void } = {},
): Promise<boolean> {
  if (!waking) {
    waking = pingUntilAwake(maxMs).finally(() => {
      waking = null;
    });
  }
  const slowTimer = onSlow ? setTimeout(onSlow, WAKE_SLOW_AFTER_MS) : null;
  try {
    return await waking;
  } finally {
    if (slowTimer) clearTimeout(slowTimer);
  }
}
