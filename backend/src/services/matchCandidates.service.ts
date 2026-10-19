// Loads the inputs for match scoring from the database (DB §10.7, FLOW
// §10.11 steps 1 to 3) and ranks them. Never calls Qloo; used by the
// match-refresh job and by the first read of GET /items/:id/matches.

import { db } from '../config/db.config';
import { matchConfig } from '../config/match.config';
import { getShownSuggestionIds } from './wantSuggestions.service';
import {
   ladderLevel,
   MIN_POOL,
   rankMatches,
   type CandidateInput,
   type OwnerWants,
   type PoolTier,
   type ScoredMatch,
   type SourceInput,
} from './matchScoring';

/** Newest items taken per tier. */
export const TIER_TAKE = 200;

export interface MatchSource {
   id: string;
   userId: string;
   categoryId: string;
   status: string;
   desiredTrade: string | null;
}

export interface ComputedMatches {
   rows: ScoredMatch[];
   level: 2 | 3 | 4;
}

/** Available, not deleted, someone else's, owner not deleted. */
function eligibleWhere(ownerId: string) {
   return {
      status: 'available',
      deletedAt: null,
      userId: { not: ownerId },
      user: { deletedAt: null },
   };
}

async function loadTier(
   ownerId: string,
   tier: PoolTier,
   categoryIds: string[] | null,
   excludeIds: string[],
): Promise<CandidateInput[]> {
   if (categoryIds && categoryIds.length === 0) return [];
   const items = await db.item.findMany({
      where: {
         ...eligibleWhere(ownerId),
         ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
         ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
      },
      select: { id: true, userId: true, categoryId: true, title: true, createdAt: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: TIER_TAKE,
   });
   return items.map((i) => ({ ...i, tier }));
}

/** Pool tiers 1 to 3: each later tier only when the pool is still small. */
async function loadCandidates(
   source: MatchSource,
   wantIds: string[],
   unpicked: string[],
): Promise<CandidateInput[]> {
   if (wantIds.length === 0) return loadTier(source.userId, 3, null, []);

   const pool = await loadTier(source.userId, 1, wantIds, []);
   if (pool.length < MIN_POOL) {
      pool.push(...(await loadTier(source.userId, 2, unpicked, [])));
   }
   if (pool.length < MIN_POOL) {
      pool.push(...(await loadTier(source.userId, 3, null, pool.map((c) => c.id))));
   }
   return pool;
}

/** Each candidate owner's wants across their available items (best rank per category). */
async function loadOwnerWants(ownerIds: string[]): Promise<OwnerWants> {
   const out: OwnerWants = new Map();
   if (ownerIds.length === 0) return out;
   const wants = await db.itemWant.findMany({
      where: {
         item: { userId: { in: ownerIds }, status: 'available', deletedAt: null },
      },
      select: { categoryId: true, rank: true, item: { select: { userId: true } } },
   });
   for (const w of wants) {
      const byCat = out.get(w.item.userId) ?? new Map<string, number>();
      const prev = byCat.get(w.categoryId);
      if (prev === undefined || w.rank < prev) byCat.set(w.categoryId, w.rank);
      out.set(w.item.userId, byCat);
   }
   return out;
}

/** Ranks matches for an available source item from the database only. */
export async function computeMatches(source: MatchSource): Promise<ComputedMatches> {
   const [wants, categories] = await Promise.all([
      db.itemWant.findMany({
         where: { itemId: source.id },
         select: { categoryId: true, rank: true },
         orderBy: { rank: 'asc' },
      }),
      db.category.findMany({ select: { id: true, name: true } }),
   ]);

   const wantRanks = new Map(wants.map((w) => [w.categoryId, w.rank]));
   const unpicked =
      wants.length === 0
         ? []
         : (await getShownSuggestionIds(source)).filter((id) => !wantRanks.has(id));

   const input: SourceInput = {
      categoryId: source.categoryId,
      wantRanks,
      unpickedSuggested: new Set(unpicked),
      note: source.desiredTrade,
      categoryNames: new Map(categories.map((c) => [c.id, c.name])),
   };

   const candidates = await loadCandidates(source, [...wantRanks.keys()], unpicked);
   const ownerWants =
      wants.length === 0
         ? new Map()
         : await loadOwnerWants([...new Set(candidates.map((c) => c.userId))]);

   return {
      rows: rankMatches(input, candidates, ownerWants, matchConfig.weights),
      level: ladderLevel(input, candidates.length),
   };
}
