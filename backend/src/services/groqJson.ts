// ============================================================================
// Text-only Groq call that must return a JSON object (Scout language tasks:
// brand extraction, mapping unmapped brands). Same env and fetch pattern as
// valuation.service.ts. Never throws: on failure it returns the reason, so
// the caller decides between retrying and its fallback (Phase 3 v3.0,
// Section 10.9). Paced by groqLimiter; a 429 is logged and, when Retry-After
// is short, retried once.
// ============================================================================
import { groqLimiter, handle429, type GroqLimiter } from './groqLimiter';

const TIMEOUT_MS = 15_000;
/** Caps Groq's output-token reservation: the free tier allows 1,000 output
 *  tokens per minute (OTPM), counted on the estimate, not the real output. */
export const DEFAULT_MAX_TOKENS = 150;

/** Why a call gave no value. http_<status> for a non-2xx answer. */
export type GroqFailReason =
   | 'not_configured'
   | `http_${number}`
   | 'timeout'
   | 'network'
   | 'bad_response'
   | 'invalid_json'
   | 'paced_out';

export type GroqResult<T> =
   | { ok: true; value: T }
   | { ok: false; reason: GroqFailReason };

export type GroqJsonFn = <T>(
   prompt: string,
   validate: (value: unknown) => T | null,
   opts?: { maxTokens?: number },
) => Promise<GroqResult<T>>;

/** Groq is busy or unreachable: worth retrying later (429, 5xx, timeout, network, paced out). */
export function isGroqTransient(reason: GroqFailReason): boolean {
   if (reason === 'timeout' || reason === 'network' || reason === 'paced_out') return true;
   const m = /^http_(\d+)$/.exec(reason);
   if (!m) return false;
   const status = Number(m[1]);
   return status === 429 || status >= 500;
}

/** Strip code fences and parse. undefined = not a JSON object. */
export function parseJsonObject(text: string): unknown {
   const cleaned = text.replace(/```json|```/g, '').trim();
   try {
      const v: unknown = JSON.parse(cleaned);
      return typeof v === 'object' && v !== null && !Array.isArray(v) ? v : undefined;
   } catch {
      return undefined;
   }
}

export function createGroqJson(
   fetchImpl: typeof fetch = globalThis.fetch,
   limiter: GroqLimiter = groqLimiter,
): GroqJsonFn {
   return async function groqJson<T>(
      prompt: string,
      validate: (value: unknown) => T | null,
      { maxTokens = DEFAULT_MAX_TOKENS }: { maxTokens?: number } = {},
   ): Promise<GroqResult<T>> {
      const model = process.env.GROQ_MODEL;
      const baseUrl = process.env.GROQ_BASE_URL;
      const apiKey = process.env.GROQ_API_KEY;
      if (!model || !baseUrl || !apiKey) return { ok: false, reason: 'not_configured' };

      // Invalid JSON gets one retry, and so does a 429 (after Retry-After);
      // any other transport failure does not.
      let retried429 = false;
      for (let attempt = 0; attempt < 2; attempt++) {
         if (!(await limiter.acquire())) return { ok: false, reason: 'paced_out' };
         const ctrl = new AbortController();
         const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
         let text: unknown;
         try {
            const res = await fetchImpl(`${baseUrl}/chat/completions`, {
               method: 'POST',
               headers: {
                  Authorization: `Bearer ${apiKey}`,
                  'Content-Type': 'application/json',
               },
               body: JSON.stringify({
                  model,
                  temperature: 0,
                  max_tokens: maxTokens,
                  messages: [{ role: 'user', content: prompt }],
               }),
               signal: ctrl.signal,
            });
            if (res.status === 429) {
               clearTimeout(timer);
               const waitMs = await handle429(res, 'json');
               if (retried429 || waitMs === null) return { ok: false, reason: 'http_429' };
               retried429 = true;
               await limiter.sleep(waitMs);
               attempt--;
               continue;
            }
            if (!res.ok) return { ok: false, reason: `http_${res.status}` };
            let raw: { choices?: { message?: { content?: unknown } }[] };
            try {
               raw = (await res.json()) as typeof raw;
            } catch {
               if (ctrl.signal.aborted) return { ok: false, reason: 'timeout' };
               return { ok: false, reason: 'bad_response' };
            }
            text = raw?.choices?.[0]?.message?.content;
         } catch {
            return { ok: false, reason: ctrl.signal.aborted ? 'timeout' : 'network' };
         } finally {
            clearTimeout(timer);
         }

         if (typeof text !== 'string') continue;
         const parsed = parseJsonObject(text);
         if (parsed === undefined) continue;
         const valid = validate(parsed);
         if (valid !== null) return { ok: true, value: valid };
      }
      return { ok: false, reason: 'invalid_json' };
   };
}

export const groqJson = createGroqJson();
