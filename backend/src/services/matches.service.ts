// GET /items/:id/matches (API §16.6). Reads match_results, drops candidates
// that are no longer eligible, and queues a refresh when there are no rows
// yet or they are stale. Never calls Qloo.

import { db } from '../config/db.config';
import { matchConfig } from '../config/match.config';
import { formatItemCard, formatOwner } from '../utils/itemFormat';
import { computeMatches, type MatchSource } from './matchCandidates.service';
import { queueMatchRefresh } from './matchRefresh.service';
import { scoreLabel, type PoolTier } from './matchScoring';

export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 20;

const candidateInclude = {
   images: { where: { isPrimary: true }, take: 1 },
   valuation: true,
   user: true,
} as const;

interface Entry {
   rank: number;
   candidate: any;
   score: number;
   poolTier: number;
   source: string;
   reason: string | null;
}

export interface MatchesData {
   items: {
      item: ReturnType<typeof formatItemCard>;
      owner: ReturnType<typeof formatOwner>;
      score_label: string | null;
      reason: string | null;
      owner_compatibility: null;
      source: string;
      pool_tier: number;
   }[];
   next_cursor: string | null;
   meta: {
      status: 'ready' | 'refreshing' | 'empty';
      source: 'qloo' | 'fallback' | 'mixed';
      computed_at: Date | null;
   };
}

export function encodeRankCursor(rank: number): string {
   return Buffer.from(`r:${rank}`).toString('base64url');
}

export function decodeRankCursor(cursor: string): number | null {
   const m = /^r:(\d{1,4})$/.exec(Buffer.from(cursor, 'base64url').toString());
   return m ? Number(m[1]) : null;
}

/** Still listable for this owner: available, not deleted, someone else's. */
function stillEligible(candidate: any, ownerId: string): boolean {
   return (
      candidate.status === 'available' &&
      !candidate.deletedAt &&
      candidate.userId !== ownerId &&
      !candidate.user?.deletedAt
   );
}

function setSource(entries: Entry[]): 'qloo' | 'fallback' | 'mixed' {
   const s = new Set(entries.map((e) => e.source));
   if (s.size > 1) return 'mixed';
   return s.has('qloo') ? 'qloo' : 'fallback';
}

/** Database-only result for an item with no rows yet (fallback level 2 or 3). */
async function computeNow(source: MatchSource): Promise<Entry[]> {
   const { rows } = await computeMatches(source);
   if (rows.length === 0) return [];
   const items = await db.item.findMany({
      where: { id: { in: rows.map((r) => r.candidateItemId) } },
      include: candidateInclude,
   });
   const byId = new Map(items.map((i) => [i.id, i]));
   return rows
      .filter((r) => byId.has(r.candidateItemId))
      .map((r) => ({
         rank: r.rank,
         candidate: byId.get(r.candidateItemId),
         score: r.score,
         poolTier: r.poolTier,
         source: r.source,
         reason: r.reason,
      }));
}

export async function getMatches(
   source: MatchSource,
   { limit = DEFAULT_LIMIT, afterRank = 0 }: { limit?: number; afterRank?: number } = {},
): Promise<MatchesData> {
   const stored = await db.matchResult.findMany({
      where: { sourceItemId: source.id },
      orderBy: { rank: 'asc' },
      include: { candidateItem: { include: candidateInclude } },
   });

   let entries: Entry[];
   let computedAt: Date | null = null;
   let refreshing = false;

   if (stored.length === 0) {
      entries = await computeNow(source);
      refreshing = entries.length > 0;
      await queueMatchRefresh(source.id, 'first_read');
   } else {
      computedAt = stored[0]!.computedAt;
      entries = stored
         .filter((r) => stillEligible(r.candidateItem, source.userId))
         .map((r) => ({
            rank: r.rank,
            candidate: r.candidateItem,
            score: Number(r.score),
            poolTier: r.poolTier,
            source: r.source,
            reason: r.reason,
         }));
      const ageMs = Date.now() - computedAt.getTime();
      if (ageMs > matchConfig.staleHours * 3600_000) {
         refreshing = true;
         await queueMatchRefresh(source.id, 'stale_read');
      }
   }

   const rest = entries.filter((e) => e.rank > afterRank);
   const page = rest.slice(0, limit);
   const last = page.at(-1);

   return {
      items: page.map((e) => ({
         item: formatItemCard(e.candidate),
         owner: formatOwner(e.candidate.user),
         score_label: scoreLabel(e.score, e.poolTier as PoolTier),
         reason: e.reason,
         owner_compatibility: null,
         source: e.source,
         pool_tier: e.poolTier,
      })),
      next_cursor: rest.length > limit && last ? encodeRankCursor(last.rank) : null,
      meta: {
         status: refreshing ? 'refreshing' : entries.length === 0 ? 'empty' : 'ready',
         source: setSource(entries),
         computed_at: computedAt,
      },
   };
}
