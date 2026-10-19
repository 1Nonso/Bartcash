// match_summary on GET /items/mine and match_context on GET /items/:id
// (API §16.8, FLOW §10.8). Database only; never calls Qloo. Missing or
// stale matches queue a refresh (reads are capped at one per item per hour).

import { db } from '../config/db.config';
import { matchConfig } from '../config/match.config';
import {
   loadOwnerWants,
   loadSourceInput,
   TASTE_SELECT,
   tasteOf,
} from './matchCandidates.service';
import { queueMatchRefresh } from './matchRefresh.service';
import {
   scoreAll,
   scoreLabel,
   type MatchExplanation,
   type PoolTier,
   type ScoreLabel,
} from './matchScoring';

export interface MatchSummary {
   count: number;
   top_label: ScoreLabel | null;
   status: 'ready' | 'refreshing';
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isStale(computedAt: Date): boolean {
   return Date.now() - computedAt.getTime() > matchConfig.staleHours * 3600_000;
}

/** Available, not deleted, someone else's, owner not deleted. */
function eligible(c: { status: string; deletedAt: Date | null; userId: string; user: { deletedAt: Date | null } }, ownerId: string) {
   return c.status === 'available' && !c.deletedAt && c.userId !== ownerId && !c.user.deletedAt;
}

/** match_summary for each of the owner's available items (others are left out). */
export async function getMatchSummaries(
   items: { id: string; status: string }[],
   ownerId: string,
): Promise<Map<string, MatchSummary>> {
   const ids = items.filter((i) => i.status === 'available').map((i) => i.id);
   const out = new Map<string, MatchSummary>();
   if (ids.length === 0) return out;

   const rows = await db.matchResult.findMany({
      where: { sourceItemId: { in: ids } },
      orderBy: [{ sourceItemId: 'asc' }, { rank: 'asc' }],
      select: {
         sourceItemId: true,
         score: true,
         poolTier: true,
         computedAt: true,
         candidateItem: {
            select: {
               status: true,
               deletedAt: true,
               userId: true,
               user: { select: { deletedAt: true } },
            },
         },
      },
   });

   for (const id of ids) {
      const mine = rows.filter((r) => r.sourceItemId === id);
      if (mine.length === 0) {
         out.set(id, { count: 0, top_label: null, status: 'refreshing' });
         await queueMatchRefresh(id, 'first_read');
         continue;
      }
      const live = mine.filter((r) => eligible(r.candidateItem, ownerId));
      const top = live[0];
      const stale = isStale(mine[0]!.computedAt);
      if (stale) await queueMatchRefresh(id, 'stale_read');
      out.set(id, {
         count: live.length,
         top_label: top ? scoreLabel(Number(top.score), top.poolTier as PoolTier) : null,
         status: stale ? 'refreshing' : 'ready',
      });
   }
   return out;
}

/**
 * Why `candidate` matches the caller's listing `contextItemId`, or null when
 * the context is not the caller's available listing or the candidate is not
 * eligible. Reads the stored explanation; without one, builds a database-only
 * version (source fallback) and queues a refresh.
 */
export async function getMatchContext(
   contextItemId: string | undefined,
   callerId: string | undefined,
   candidate: { id: string; userId: string; categoryId: string; title: string; status: string; createdAt: Date },
): Promise<MatchExplanation | null> {
   if (!contextItemId || !callerId || !UUID_RE.test(contextItemId)) return null;
   if (candidate.status !== 'available' || candidate.userId === callerId) return null;

   const context = await db.item.findFirst({
      where: { id: contextItemId, userId: callerId, status: 'available', deletedAt: null },
      select: { id: true, userId: true, categoryId: true, status: true, desiredTrade: true },
   });
   if (!context) return null;

   const stored = await db.matchResult.findUnique({
      where: {
         sourceItemId_candidateItemId: { sourceItemId: context.id, candidateItemId: candidate.id },
      },
      select: { explanation: true, computedAt: true },
   });
   if (stored?.explanation) {
      if (isStale(stored.computedAt)) await queueMatchRefresh(context.id, 'stale_read');
      return stored.explanation as unknown as MatchExplanation;
   }

   // Lightweight: category fit, R and shared tags from the database.
   const [{ input }, candTaste] = await Promise.all([
      loadSourceInput(context),
      db.itemTaste.findUnique({ where: { itemId: candidate.id }, ...TASTE_SELECT }),
   ]);
   const ownerWants = await loadOwnerWants([candidate.userId]);
   const tier: PoolTier = input.wantRanks.has(candidate.categoryId)
      ? 1
      : input.unpickedSuggested.has(candidate.categoryId)
        ? 2
        : 3;
   const t = tasteOf(candTaste);
   const [scored] = scoreAll(
      input,
      [{ ...candidate, tier, entityId: t.entityId, tags: t.tags }],
      ownerWants,
      matchConfig.weights,
   );
   // Only when the listing has no matches yet: a candidate outside the top
   // 50 is not a reason to refresh.
   if ((await db.matchResult.count({ where: { sourceItemId: context.id } })) === 0) {
      await queueMatchRefresh(context.id, 'first_read');
   }
   return scored?.explanation ?? null;
}
