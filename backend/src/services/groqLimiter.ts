import { Pacer } from './qloo/qlooPacer';

// ============================================================================
// Groq request pacing, shared by every Groq caller in this process
// (valuation, brand extraction, brand mapping). They use one key and model,
// limited to 30 requests per minute. GROQ_RPM is per process: the values of
// all processes must add up to 25 or less (20 worker + 5 API, or 25 when one
// process runs both).
// ============================================================================

const DEFAULT_RPM = 20;
/** Longest a caller waits for its turn before giving up (paced_out). */
export const GROQ_MAX_WAIT_MS = 60_000;
/** Wait after a 429 when Retry-After is missing or unreadable. */
export const RETRY_AFTER_DEFAULT_MS = 20_000;
/** Longest in-call wait after a 429. A longer Retry-After (a daily limit)
 *  is not waited for: the call fails and the job's own retry takes over. */
export const RETRY_AFTER_CAP_MS = 30_000;

export interface GroqLimiter {
   /** True once it is this caller's turn; false after GROQ_MAX_WAIT_MS. */
   acquire(): Promise<boolean>;
   sleep(ms: number): Promise<void>;
}

function rpmFromEnv(): number {
   const n = Number(process.env.GROQ_RPM);
   return Number.isInteger(n) && n >= 1 ? n : DEFAULT_RPM;
}

export function createGroqLimiter(
   rpm: number,
   now: () => number = Date.now,
   sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): GroqLimiter {
   const pacer = new Pacer(rpm / 60, now, sleep);
   return { acquire: () => pacer.acquire(GROQ_MAX_WAIT_MS), sleep };
}

export const groqLimiter = createGroqLimiter(rpmFromEnv());

/** Retry-After in ms: seconds or an HTTP date. Missing or unreadable gives the default. */
export function retryAfterMs(header: string | null, nowMs: number = Date.now()): number {
   let ms = RETRY_AFTER_DEFAULT_MS;
   if (header) {
      const secs = Number(header);
      if (Number.isFinite(secs) && secs >= 0) ms = secs * 1000;
      else {
         const at = Date.parse(header);
         if (!Number.isNaN(at)) ms = Math.max(0, at - nowMs);
      }
   }
   return ms;
}

/** Which Groq limit a 429 hit, from its message ("... tokens per day (TPD) ...",
 *  "... output tokens per minute (OTPM) ..."),
 *  or capacity when Groq is out of capacity rather than the key out of quota. */
export function limitCode(message: string): string {
   const m = /\(([A-Z]{2,6})\)/.exec(message)?.[1];
   if (m) return m;
   return /capacity/i.test(message) ? 'capacity' : 'unknown';
}

/** Groq's error type / code, reduced to a safe token for the log. */
function errorToken(v: unknown): string {
   return typeof v === 'string' && /^[a-z0-9_]{1,40}$/i.test(v) ? v : '-';
}

/**
 * Logs a 429 (limit code, error type and code, Retry-After, remaining-* headers; never the message
 * itself, which names the organisation) and consumes its body. Returns the
 * wait before one more try, or null when Retry-After is above the cap.
 */
export async function handle429(res: Response, caller: string): Promise<number | null> {
   let message = '';
   let type = '-';
   let code = '-';
   try {
      const body = (await res.json()) as {
         error?: { message?: unknown; type?: unknown; code?: unknown };
      };
      if (typeof body?.error?.message === 'string') message = body.error.message;
      type = errorToken(body?.error?.type);
      code = errorToken(body?.error?.code);
   } catch {
      // Unreadable body: the limit code stays unknown.
   }
   const header = res.headers.get('retry-after');
   const waitMs = retryAfterMs(header);
   const h = (name: string) => res.headers.get(name) ?? '-';
   console.warn(
      `groq: 429 (${caller}) limit=${limitCode(message)} type=${type} code=${code} ` +
         `retry-after=${header ?? '-'} ` +
         `remaining-requests=${h('x-ratelimit-remaining-requests')} ` +
         `remaining-tokens=${h('x-ratelimit-remaining-tokens')}`,
   );
   return waitMs <= RETRY_AFTER_CAP_MS ? waitMs : null;
}
