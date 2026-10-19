// Pure match scoring (DB §10.7). No database or network here: the
// match-refresh job and GET /items/:id/matches load the inputs and call
// rankMatches. Fixtures: src/scripts/match-fixtures.ts.

import type { MatchWeights } from '../config/match.config';

export const MAX_MATCHES = 50;
/** Fewer candidates than this in the tiers so far pulls in the next tier. */
export const MIN_POOL = 10;

/** W by want rank; unpicked suggestions and anything else below. */
export const WANT_RANK_FIT: Record<number, number> = { 1: 1.0, 2: 0.85, 3: 0.7 };
export const SUGGESTED_FIT = 0.4;
export const OTHER_FIT = 0.2;
export const NOTE_BONUS = 0.1;

export const STRONG_AT = 0.7;
export const GOOD_AT = 0.5;

export type PoolTier = 1 | 2 | 3;
export type ScoreLabel = 'strong' | 'good' | 'possible';

export interface SourceInput {
   categoryId: string;
   /** The owner's picks: categoryId → rank 1 to 3. Empty: no wants (level 3). */
   wantRanks: Map<string, number>;
   /** Suggested categories the owner did not pick (tier 2). */
   unpickedSuggested: Set<string>;
   /** The owner's free-text note (items.desired_trade). */
   note: string | null;
   /** Category names, for the reason line. */
   categoryNames: Map<string, string>;
}

export interface CandidateInput {
   id: string;
   userId: string;
   categoryId: string;
   title: string;
   createdAt: Date;
   tier: PoolTier;
}

/** Wants on the candidate owner's available items: categoryId → best rank. */
export type OwnerWants = Map<string, Map<string, number>>;

export interface ScoredMatch {
   candidateItemId: string;
   rank: number;
   score: number;
   wantsFit: number | null;
   tasteAffinity: number | null;
   reciprocalFit: number | null;
   ownerCompatibility: number | null;
   poolTier: PoolTier;
   source: 'qloo' | 'fallback';
   reason: string;
}

const STOP_WORDS = new Set([
   'the', 'and', 'for', 'with', 'any', 'anything', 'something', 'similar',
   'value', 'good', 'new', 'used', 'condition', 'item', 'items', 'swap',
   'trade', 'exchange', 'want', 'looking', 'like', 'or', 'of', 'a', 'an',
   'in', 'on', 'to', 'my', 'your', 'one', 'some', 'other', 'etc', 'please',
]);

/** Lower-case words of 3+ letters or digits, without stop words. */
export function keywords(text: string | null | undefined): Set<string> {
   const out = new Set<string>();
   for (const w of (text ?? '').toLowerCase().split(/[^a-z0-9]+/)) {
      if (w.length >= 3 && !STOP_WORDS.has(w)) out.add(w);
   }
   return out;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Component W: category fit plus the note bonus, capped at 1. */
export function wantsFit(
   source: SourceInput,
   candidate: { categoryId: string; title: string },
   noteWords: Set<string> = keywords(source.note),
): number {
   const rank = source.wantRanks.get(candidate.categoryId);
   let fit =
      rank !== undefined
         ? (WANT_RANK_FIT[rank] ?? OTHER_FIT)
         : source.unpickedSuggested.has(candidate.categoryId)
           ? SUGGESTED_FIT
           : OTHER_FIT;
   if (noteWords.size > 0) {
      for (const w of keywords(candidate.title)) {
         if (noteWords.has(w)) {
            fit += NOTE_BONUS;
            break;
         }
      }
   }
   return round3(Math.min(1, fit));
}

/**
 * Component R: how well the source item's category suits the candidate
 * owner's wants (W scale). Null when that owner has no wants at all.
 */
export function reciprocalFit(
   sourceCategoryId: string,
   ownerWants: Map<string, number> | undefined,
): number | null {
   if (!ownerWants || ownerWants.size === 0) return null;
   const rank = ownerWants.get(sourceCategoryId);
   return rank !== undefined ? (WANT_RANK_FIT[rank] ?? OTHER_FIT) : OTHER_FIT;
}

/** Weighted mean of the non-null components (weights renormalised). */
export function combine(
   c: { wants: number | null; taste: number | null; reciprocal: number | null; owner: number | null },
   w: MatchWeights,
): number {
   let sum = 0;
   let weight = 0;
   for (const k of ['wants', 'taste', 'reciprocal', 'owner'] as const) {
      const v = c[k];
      if (v === null || w[k] <= 0) continue;
      sum += v * w[k];
      weight += w[k];
   }
   return weight > 0 ? round3(sum / weight) : 0;
}

/** Shown to users instead of the score. Tier 3 has no label. */
export function scoreLabel(score: number, tier: PoolTier): ScoreLabel | null {
   if (tier === 3) return null;
   if (score >= STRONG_AT) return 'strong';
   if (score >= GOOD_AT) return 'good';
   return 'possible';
}

/** Template reason (Groq reasons for the top 10 come later). */
export function templateReason(source: SourceInput, c: CandidateInput): string {
   const name = source.categoryNames.get(c.categoryId) ?? 'this category';
   if (c.tier === 1) {
      return source.wantRanks.get(c.categoryId) === 1
         ? `Matches your top want: ${name}`
         : `Matches your want: ${name}`;
   }
   if (c.tier === 2) return `Scout suggests ${name}`;
   return 'Recently listed';
}

/** Fallback ladder level, for logs: 2 scored, 3 no wants, 4 no candidates. */
export function ladderLevel(source: SourceInput, candidateCount: number): 2 | 3 | 4 {
   if (candidateCount === 0) return 4;
   return source.wantRanks.size === 0 ? 3 : 2;
}

/**
 * Scores, sorts and keeps the top MAX_MATCHES. With no wants (level 3)
 * candidates are ordered by recency only and W/R are not stored.
 */
export function rankMatches(
   source: SourceInput,
   candidates: CandidateInput[],
   ownerWants: OwnerWants,
   weights: MatchWeights,
): ScoredMatch[] {
   const noWants = source.wantRanks.size === 0;
   const noteWords = keywords(source.note);

   const scored = candidates.map((c) => {
      const w = noWants ? null : wantsFit(source, c, noteWords);
      const r = noWants ? null : reciprocalFit(source.categoryId, ownerWants.get(c.userId));
      const score = noWants
         ? 0
         : combine({ wants: w, taste: null, reciprocal: r, owner: null }, weights);
      return { c, w, r, score };
   });

   scored.sort(
      (a, b) =>
         b.score - a.score ||
         b.c.createdAt.getTime() - a.c.createdAt.getTime() ||
         (a.c.id < b.c.id ? 1 : -1),
   );

   return scored.slice(0, MAX_MATCHES).map(({ c, w, r, score }, i) => ({
      candidateItemId: c.id,
      rank: i + 1,
      score,
      wantsFit: w,
      tasteAffinity: null,
      reciprocalFit: r,
      ownerCompatibility: null,
      poolTier: c.tier,
      source: 'fallback',
      reason: templateReason(source, c),
   }));
}
