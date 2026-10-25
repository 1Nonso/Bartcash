// The match-refresh job (FLOW §10.11): rank the source item's matches (with
// taste T from one Qloo call) and replace its match_results rows in one
// transaction. Owner compatibility (O) comes from taste_compatibilities.

import { db } from '../config/db.config';
import type { Prisma } from '../generated/prisma/client';
import { computeMatches } from './matchCandidates.service';
import { defaultMatchQloo, type MatchQloo } from './matchTaste.service';

export type MatchRefreshResult =
   | { outcome: 'cleared' }
   | { outcome: 'refreshed'; count: number; level: 1 | 2 | 3 | 4; taste: string };

export async function runMatchRefresh(
   itemId: string,
   qloo: MatchQloo | null = null,
): Promise<MatchRefreshResult> {
   const source = await db.item.findUnique({
      where: { id: itemId },
      select: {
         id: true,
         userId: true,
         categoryId: true,
         status: true,
         desiredTrade: true,
         deletedAt: true,
      },
   });

   // Not available (draft, in a trade, deleted): it has no matches.
   if (!source || source.deletedAt || source.status !== 'available') {
      await db.matchResult.deleteMany({ where: { sourceItemId: itemId } });
      return { outcome: 'cleared' };
   }

   const { rows, level, taste } = await computeMatches(source, {
      qloo: qloo ?? (await defaultMatchQloo()),
   });
   const computedAt = new Date();

   await db.$transaction(async (tx) => {
      await tx.matchResult.deleteMany({ where: { sourceItemId: itemId } });
      if (rows.length === 0) return;
      await tx.matchResult.createMany({
         data: rows.map((r) => ({
            sourceItemId: itemId,
            candidateItemId: r.candidateItemId,
            rank: r.rank,
            score: r.score,
            wantsFit: r.wantsFit,
            tasteAffinity: r.tasteAffinity,
            reciprocalFit: r.reciprocalFit,
            ownerCompatibility: r.ownerCompatibility,
            poolTier: r.poolTier,
            source: r.source,
            reason: r.reason,
            explanation: r.explanation as unknown as Prisma.InputJsonValue,
            computedAt,
         })),
      });
   });

   return { outcome: 'refreshed', count: rows.length, level, taste };
}
