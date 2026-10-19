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
/** R used for scoring when the other owner has no wants: neutral, so an
 *  unknown owner never outranks one who wants the source item. Stored as null. */
export const RECIPROCAL_UNKNOWN = 0.5;

/** Labels: strong needs taste or mutual interest on top of a wanted category
 *  (a wanted category alone scores 0.833). Re-check on the demo seed. */
export const STRONG_AT = 0.85;
export const GOOD_AT = 0.6;
/** Per-component check results (match_context): strong / partial. */
export const CHECK_STRONG_AT = 0.7;
export const CHECK_PARTIAL_AT = 0.4;

/** Candidate brands sent to Qloo in the one insights call. */
export const MAX_TASTE_ENTITIES = 50;
/** T at or above this adds the taste clause to the reason (raw Qloo
 *  affinity: popular brands sit around 0.8 to 0.95). */
export const TASTE_REASON_AT = 0.9;
/** T used for scoring when the set has taste but this candidate has none
 *  (no brand, or not returned): neutral, like RECIPROCAL_UNKNOWN. Stored as null. */
export const TASTE_UNKNOWN = 0.5;
export const REASON_MAX = 140;
export const SHARED_TAGS_MAX = 6;

/** { tag_id, name } as stored on item_tastes.tags. */
export interface TagRef {
   tag_id: string;
   name: string;
}

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
   /** The listing's resolved Qloo brand, when there is one. */
   entityName?: string | null;
   tags?: TagRef[];
}

export interface CandidateInput {
   id: string;
   userId: string;
   categoryId: string;
   title: string;
   createdAt: Date;
   tier: PoolTier;
   /** The candidate's resolved Qloo brand, when there is one. */
   entityId?: string | null;
   tags?: TagRef[];
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
   explanation: MatchExplanation;
}

export type CheckResult = 'strong' | 'partial' | 'none' | 'unknown';
export type CheckKey = 'wants_fit' | 'taste_fit' | 'reciprocal_fit' | 'shared_interests';

/** Stored on match_results.explanation; read back as match_context (API §16.3). */
export interface MatchExplanation {
   score_label: ScoreLabel | null;
   reason: string;
   checked: { key: CheckKey; label: string; result: CheckResult }[];
   shared_interests: unknown[];
   shared_tags: TagRef[];
   source: 'qloo' | 'fallback';
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

/** Template reason (Groq reasons are deferred). A strong T adds a taste clause. */
export function templateReason(
   source: SourceInput,
   c: CandidateInput,
   taste: number | null = null,
): string {
   const name = source.categoryNames.get(c.categoryId) ?? 'this category';
   let base =
      c.tier === 1
         ? source.wantRanks.get(c.categoryId) === 1
            ? `Matches your top want: ${name}`
            : `Matches your want: ${name}`
         : c.tier === 2
           ? `Scout suggests ${name}`
           : 'Recently listed';
   if (taste !== null && taste >= TASTE_REASON_AT && source.entityName) {
      base += ` · popular with ${source.entityName} fans`;
   }
   return base.length > REASON_MAX ? `${base.slice(0, REASON_MAX - 1)}…` : base;
}

/** strong ≥ 0.70, partial ≥ 0.40, none below, unknown when null. */
export function checkResult(v: number | null): CheckResult {
   if (v === null) return 'unknown';
   if (v >= CHECK_STRONG_AT) return 'strong';
   if (v >= CHECK_PARTIAL_AT) return 'partial';
   return 'none';
}

/** Tag types worth showing people, in display order (others such as
 *  brand_type, business_model or key_market read as noise). */
export const SHOWN_TAG_PREFIXES = [
   'urn:tag:genre:brand:',
   'urn:tag:aesthetic_property:',
   'urn:tag:lifestyle:',
   'urn:tag:core_value:',
];

function tagOrder(tagId: string): number {
   return SHOWN_TAG_PREFIXES.findIndex((p) => tagId.startsWith(p));
}

/** Shown tags both brands share, genre first, at most six. */
export function sharedTags(a: TagRef[] = [], b: TagRef[] = []): TagRef[] {
   const other = new Set(b.map((t) => t.tag_id));
   return a
      .filter((t) => other.has(t.tag_id) && tagOrder(t.tag_id) >= 0)
      .map((t, i) => ({ t, i, o: tagOrder(t.tag_id) }))
      .sort((x, y) => x.o - y.o || x.i - y.i)
      .map(({ t }) => t)
      .slice(0, SHARED_TAGS_MAX);
}

export function buildExplanation(args: {
   score: number;
   tier: PoolTier;
   reason: string;
   wants: number | null;
   taste: number | null;
   reciprocal: number | null;
   tags: TagRef[];
}): MatchExplanation {
   return {
      score_label: scoreLabel(args.score, args.tier),
      reason: args.reason,
      checked: [
         { key: 'wants_fit', label: 'Fits what you want', result: checkResult(args.wants) },
         { key: 'taste_fit', label: 'Similar taste', result: checkResult(args.taste) },
         { key: 'reciprocal_fit', label: 'They may want yours', result: checkResult(args.reciprocal) },
         // Needs taste profiles (Phase 4, taste profile step).
         { key: 'shared_interests', label: 'Shared interests', result: 'unknown' },
      ],
      shared_interests: [],
      shared_tags: args.tags,
      source: args.taste !== null ? 'qloo' : 'fallback',
   };
}

/**
 * Brands to send to Qloo: distinct candidate entities in the given order
 * (best W/R first), skipping the signals themselves (they score 1.00).
 */
export function pickTasteEntities(
   ordered: CandidateInput[],
   signals: Set<string>,
   max = MAX_TASTE_ENTITIES,
): string[] {
   const out: string[] = [];
   const seen = new Set<string>();
   for (const c of ordered) {
      const e = c.entityId;
      if (!e || signals.has(e) || seen.has(e)) continue;
      seen.add(e);
      out.push(e);
      if (out.length >= max) break;
   }
   return out;
}

/**
 * Component T per candidate: Qloo's raw affinity (already 0 to 1; a
 * rescale within the set turned small gaps such as 0.934 vs 0.811 into
 * 1.00 vs 0.00); a candidate whose brand is a signal scores 1.00; no brand
 * or not returned -> null.
 */
export function tasteScores(
   candidates: CandidateInput[],
   signals: Set<string>,
   affinity: Map<string, number>,
): Map<string, number | null> {
   const out = new Map<string, number | null>();
   for (const c of candidates) {
      const e = c.entityId;
      if (!e) out.set(c.id, null);
      else if (signals.has(e)) out.set(c.id, 1);
      else if (affinity.has(e)) out.set(c.id, round3(Math.min(1, Math.max(0, affinity.get(e)!))));
      else out.set(c.id, null);
   }
   return out;
}

/** Fallback ladder level, for logs: 1 with T (O is never set yet), 2 without, 3 no wants, 4 no candidates. */
export function ladderLevel(
   source: SourceInput,
   candidateCount: number,
   tasteUsed = false,
): 1 | 2 | 3 | 4 {
   if (candidateCount === 0) return 4;
   if (source.wantRanks.size === 0) return 3;
   return tasteUsed ? 1 : 2;
}

/**
 * Scores and sorts every candidate. With no wants (level 3) candidates are
 * ordered by recency only and W/R/T are not stored. `taste` maps candidate
 * id -> T (null or absent: no taste component).
 */
export function scoreAll(
   source: SourceInput,
   candidates: CandidateInput[],
   ownerWants: OwnerWants,
   weights: MatchWeights,
   taste: Map<string, number | null> | null = null,
): Omit<ScoredMatch, 'rank'>[] {
   const noWants = source.wantRanks.size === 0;
   const noteWords = keywords(source.note);

   const scored = candidates.map((c) => {
      const w = noWants ? null : wantsFit(source, c, noteWords);
      const r = noWants ? null : reciprocalFit(source.categoryId, ownerWants.get(c.userId));
      const t = noWants ? null : (taste?.get(c.id) ?? null);
      // With taste for the set, a missing T is neutral; without it, T is dropped.
      const tScore = taste ? (t ?? TASTE_UNKNOWN) : null;
      const score = noWants
         ? 0
         : combine(
              { wants: w, taste: tScore, reciprocal: r ?? RECIPROCAL_UNKNOWN, owner: null },
              weights,
           );
      return { c, w, r, t, score };
   });

   scored.sort(
      (a, b) =>
         b.score - a.score ||
         b.c.createdAt.getTime() - a.c.createdAt.getTime() ||
         (a.c.id < b.c.id ? 1 : -1),
   );

   return scored.map(({ c, w, r, t, score }) => {
      const reason = templateReason(source, c, t);
      return {
         candidateItemId: c.id,
         score,
         wantsFit: w,
         tasteAffinity: t,
         reciprocalFit: r,
         ownerCompatibility: null,
         poolTier: c.tier,
         source: t !== null ? 'qloo' : 'fallback',
         reason,
         explanation: buildExplanation({
            score,
            tier: c.tier,
            reason,
            wants: w,
            taste: t,
            reciprocal: r,
            tags: sharedTags(source.tags, c.tags),
         }),
      };
   });
}

/** scoreAll, keeping the top MAX_MATCHES with ranks from 1. */
export function rankMatches(
   source: SourceInput,
   candidates: CandidateInput[],
   ownerWants: OwnerWants,
   weights: MatchWeights,
   taste: Map<string, number | null> | null = null,
): ScoredMatch[] {
   return scoreAll(source, candidates, ownerWants, weights, taste)
      .slice(0, MAX_MATCHES)
      .map((m, i) => ({ ...m, rank: i + 1 }));
}
