// Valuation failure codes. item_valuations.failed_reason stores a short code,
// never the raw error: Groq's error text names the org and an upgrade link.
// Responses send a short message for the code. Rows written before the codes
// existed are classified the same way, so raw text never reaches a client.

export type ValuationFailureCode =
   | 'rate_limited'
   | 'ai_unavailable'
   | 'image_unavailable'
   | 'no_image'
   | 'invalid_response'
   | 'unknown';

const MESSAGES: Record<ValuationFailureCode, string> = {
   rate_limited: 'Our AI valuer was busy. Try again in a minute.',
   ai_unavailable: "Our AI valuer couldn't be reached. Try again later.",
   image_unavailable: "We couldn't read the listing photo. Try again, or change the main photo.",
   no_image: 'Add a photo to get a valuation.',
   invalid_response: "Our AI valuer's answer couldn't be used. Try again.",
   unknown: 'Something went wrong. Try again.',
};

const CODES = new Set(Object.keys(MESSAGES));

/** A stored code, or a raw error message (old rows, thrown errors), as a code. */
export function valuationFailureCode(raw: string | null | undefined): ValuationFailureCode {
   const s = (raw ?? '').trim();
   if (CODES.has(s)) return s as ValuationFailureCode;
   if (/rate limit|\b429\b|paced out|too many requests/i.test(s)) return 'rate_limited';
   if (/no images/i.test(s)) return 'no_image';
   if (/fetch image/i.test(s)) return 'image_unavailable';
   if (/empty response|unexpected format|json/i.test(s)) return 'invalid_response';
   if (/groq|fetch failed|network|timeout|timed out|econn|enotfound|socket|queue/i.test(s)) {
      return 'ai_unavailable';
   }
   return 'unknown';
}

/** The message sent to clients for a stored failed_reason; null when none. */
export function valuationFailureMessage(raw: string | null | undefined): string | null {
   if (raw === null || raw === undefined || raw === '') return null;
   return MESSAGES[valuationFailureCode(raw)];
}
