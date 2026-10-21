// Loads the inputs for match scoring from the database (DB §10.7, FLOW
// §10.11 steps 1 to 5) and ranks them. Only the match-refresh job passes a
// Qloo client (component T); the request path ranks from the database only.

import { db } from '../config/db.config';
import { matchConfig } from '../config/match.config';
import { getShownSuggestionIds } from './wantSuggestions.service';
import {
   ladderLevel,
   pickTasteEntities,
   rankMatches,
   scoreAll,
   tasteScores,
   type CandidateInput,
   type OwnerFits,
   type OwnerWants,
   type PoolTier,
   type ScoredMatch,
   type SourceInput,
   type TagRef,
} from './matchScoring';
import { fetchAffinities, type MatchQloo } from './matchTaste.service';
import { MIN_ACTIVE_ENTITIES } from './tasteSummary';
import { ownerScore, readShared, SHOWN_MAX } from './tasteCompat';

/** Newest items taken per tier. */
export const TIER_TAKE = 200;
/** The owner's most recent taste entities added to the signals. */
export const TASTE_SIGNALS_FROM_PROFILE = 4;

export interface MatchSource {
   id: string;
   userId: string;
   categoryId: string;
   status: string;
   desiredTrade: string | null;
}

export interface ComputedMatches {
   rows: ScoredMatch[];
   level: 1 | 2 | 3 | 4;
   /** What happened with Qloo: called, skipped (why) or failed (reason). Logged. */
   taste: string;
}

export const TASTE_SELECT = { select: { status: true, qlooEntityId: true, qlooEntityName: true, tags: true } } as const;

type TasteRow = { status: string; qlooEntityId: string | null; qlooEntityName: string | null; tags: unknown } | null;

/** Resolved brand and tags of an item, or nulls. */
export function tasteOf(t: TasteRow): { entityId: string | null; entityName: string | null; tags: TagRef[] } {
   if (!t || t.status !== 'resolved' || !t.qlooEntityId) return { entityId: null, entityName: null, tags: [] };
   const tags = Array.isArray(t.tags)
      ? (t.tags as TagRef[]).filter((x) => x && typeof x.tag_id === 'string')
      : [];
   return { entityId: t.qlooEntityId, entityName: t.qlooEntityName, tags };
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
      select: {
         id: true,
         userId: true,
         categoryId: true,
         title: true,
         createdAt: true,
         taste: TASTE_SELECT,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: TIER_TAKE,
   });
   return items.map(({ taste, ...i }) => {
      const t = tasteOf(taste);
      return { ...i, tier, entityId: t.entityId, tags: t.tags };
   });
}

/** Pool tiers 1 and 2 (Oct 20: tier 3, any other listing, is gone). */
async function loadCandidates(
   source: MatchSource,
   wantIds: string[],
   unpicked: string[],
): Promise<CandidateInput[]> {
   if (wantIds.length === 0) return [];
   const [tier1, tier2] = await Promise.all([
      loadTier(source.userId, 1, wantIds, []),
      loadTier(source.userId, 2, unpicked, []),
   ]);
   return [...tier1, ...tier2];
}

/** Each candidate owner's wants across their available items (best rank per category). */
export async function loadOwnerWants(ownerIds: string[]): Promise<OwnerWants> {
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

/**
 * Component O for each candidate owner from the stored taste_compatibilities
 * (DB §10.8). Null when the source owner's profile is inactive.
 */
export async function loadOwnerFits(sourceOwnerId: string, ownerIds: string[]): Promise<OwnerFits | null> {
   const counts = await db.userTasteEntity.groupBy({
      by: ['userId'],
      where: { userId: { in: [sourceOwnerId, ...ownerIds] } },
      _count: { _all: true },
   });
   const active = new Set(counts.filter((c) => c._count._all >= MIN_ACTIVE_ENTITIES).map((c) => c.userId));
   if (!active.has(sourceOwnerId)) return null;

   const pairs = await db.tasteCompatibility.findMany({
      where: {
         OR: [
            { userAId: sourceOwnerId, userBId: { in: ownerIds } },
            { userBId: sourceOwnerId, userAId: { in: ownerIds } },
         ],
      },
      select: { userAId: true, userBId: true, score: true, sharedEntities: true },
   });
   const byOwner = new Map(pairs.map((p) => [p.userAId === sourceOwnerId ? p.userBId : p.userAId, p]));

   const out: OwnerFits = new Map();
   for (const id of ownerIds) {
      if (!active.has(id)) {
         out.set(id, { o: null, shared: [] });
         continue;
      }
      const p = byOwner.get(id);
      out.set(
         id,
         p
            ? { o: ownerScore(Number(p.score)), shared: readShared(p.sharedEntities).slice(0, SHOWN_MAX) }
            : { o: 0, shared: [] },
      );
   }
   return out;
}

/**
 * Ranks matches for an available source item. With `qloo` (the job only),
 * adds component T from one batched insights call; without it, or when
 * Qloo is unavailable, T is null (fallback level 2).
 */
/** The source item's wants, suggestions, note and brand as scoring input. */
export async function loadSourceInput(source: MatchSource) {
   const [wants, categories, sourceTaste] = await Promise.all([
      db.itemWant.findMany({
         where: { itemId: source.id },
         select: { categoryId: true, rank: true },
         orderBy: { rank: 'asc' },
      }),
      db.category.findMany({ select: { id: true, name: true } }),
      db.itemTaste.findUnique({ where: { itemId: source.id }, ...TASTE_SELECT }),
   ]);

   const wantRanks = new Map(wants.map((w) => [w.categoryId, w.rank]));
   const unpicked =
      wants.length === 0
         ? []
         : (await getShownSuggestionIds(source)).filter((id) => !wantRanks.has(id));
   const own = tasteOf(sourceTaste);

   const input: SourceInput = {
      categoryId: source.categoryId,
      wantRanks,
      unpickedSuggested: new Set(unpicked),
      note: source.desiredTrade,
      categoryNames: new Map(categories.map((c) => [c.id, c.name])),
      entityName: own.entityName,
      tags: own.tags,
   };
   return { input, wants, unpicked, own };
}

export async function computeMatches(
   source: MatchSource,
   { qloo = null }: { qloo?: MatchQloo | null } = {},
): Promise<ComputedMatches> {
   const { input, wants, unpicked, own } = await loadSourceInput(source);
   const { wantRanks } = input;

   const candidates = await loadCandidates(source, [...wantRanks.keys()], unpicked);
   const ownerIds = [...new Set(candidates.map((c) => c.userId))];
   const [ownerWants, owners] =
      wants.length === 0
         ? [new Map() as OwnerWants, null]
         : await Promise.all([loadOwnerWants(ownerIds), loadOwnerFits(source.userId, ownerIds)]);

   const weights = matchConfig.weights;
   let taste: Map<string, number | null> | null = null;
   let tasteNote = qloo ? 'skipped_no_wants' : 'not_requested';

   if (qloo && wants.length > 0 && candidates.length > 0) {
      const profile = await db.userTasteEntity.findMany({
         where: { userId: source.userId },
         select: { qlooEntityId: true },
         orderBy: { createdAt: 'desc' },
         take: TASTE_SIGNALS_FROM_PROFILE,
      });
      const signals = [
         ...new Set([...(own.entityId ? [own.entityId] : []), ...profile.map((p) => p.qlooEntityId)]),
      ];
      const signalSet = new Set(signals);
      // Best W/R first, so the 50 brands sent are the likeliest matches.
      const byId = new Map(candidates.map((c) => [c.id, c]));
      const ordered = scoreAll(input, candidates, ownerWants, weights, null, owners).map(
         (m) => byId.get(m.candidateItemId)!,
      );
      const entityIds = pickTasteEntities(ordered, signalSet);
      const sameBrand = candidates.some((c) => c.entityId && signalSet.has(c.entityId));

      if (signals.length === 0) tasteNote = 'skipped_no_signal';
      else if (entityIds.length === 0 && !sameBrand) tasteNote = 'skipped_no_candidate_brands';
      else {
         const r =
            entityIds.length > 0
               ? await fetchAffinities(qloo, signals, entityIds)
               : ({ ok: true, affinity: new Map<string, number>(), cached: true } as const);
         if (r.ok) {
            taste = tasteScores(candidates, signalSet, r.affinity);
            tasteNote = entityIds.length > 0 ? `called entities=${entityIds.length} cached=${r.cached}` : 'same_brand_only';
         } else {
            tasteNote = `failed_${r.reason}`;
         }
      }
   }

   const rows = rankMatches(input, candidates, ownerWants, weights, taste, owners);
   return {
      rows,
      level: ladderLevel(input, rows.length, rows.some((r) => r.tasteAffinity !== null)),
      taste: tasteNote,
   };
}
