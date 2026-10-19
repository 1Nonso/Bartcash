// Matching configuration (DB §10.7, §10.11). Pure parsing lives here so
// fixtures can test it without touching process.env.

export interface MatchWeights {
   wants: number;
   taste: number;
   reciprocal: number;
   owner: number;
}

export const DEFAULT_MATCH_WEIGHTS: MatchWeights = {
   wants: 0.4,
   taste: 0.3,
   reciprocal: 0.2,
   owner: 0.1,
};

const WEIGHT_KEYS = Object.keys(DEFAULT_MATCH_WEIGHTS) as (keyof MatchWeights)[];

/**
 * "wants=0.40,taste=0.30,reciprocal=0.20,owner=0.10". Missing keys keep their
 * default; an unknown key, a bad number or an all-zero result returns null
 * (the caller falls back to the defaults).
 */
export function parseMatchWeights(raw: string | undefined): MatchWeights | null {
   if (!raw || !raw.trim()) return { ...DEFAULT_MATCH_WEIGHTS };
   const out = { ...DEFAULT_MATCH_WEIGHTS };
   for (const part of raw.split(',')) {
      const [k, v] = part.split('=').map((s) => s?.trim());
      if (!k || v === undefined || !WEIGHT_KEYS.includes(k as keyof MatchWeights)) return null;
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) return null;
      out[k as keyof MatchWeights] = n;
   }
   return WEIGHT_KEYS.some((k) => out[k] > 0) ? out : null;
}

function parseStaleHours(raw: string | undefined): number {
   const n = Number(raw);
   return raw && Number.isFinite(n) && n > 0 ? n : 24;
}

const weights = parseMatchWeights(process.env.MATCH_WEIGHTS);
if (!weights) console.warn('match: MATCH_WEIGHTS is invalid, using defaults');

export const matchConfig = {
   weights: weights ?? { ...DEFAULT_MATCH_WEIGHTS },
   staleHours: parseStaleHours(process.env.MATCH_STALE_HOURS),
};
