// The taste-compat job (FLOW §10.12) and the one-pair read used by
// GET /users/:id/taste-compatibility. Database only; never calls Qloo.
// Each pair is one row (lower user id first), so a user's job also brings
// every pair they are in up to date for the other side.

import { db } from '../config/db.config';
import type { Prisma } from '../generated/prisma/client';
import { MIN_ACTIVE_ENTITIES } from './tasteSummary';
import { queueMatchRefresh } from './matchRefresh.service';
import {
   COMPAT_METHOD,
   COMPAT_MIN,
   compareProfiles,
   pairIds,
   readShared,
   readTags,
   type PairResult,
   type ProfileEntity,
} from './tasteCompat';

/** Other active profiles compared per run, most recently updated first. */
export const PEER_LIMIT = 200;

const ENTITY_SELECT = {
   userId: true,
   qlooEntityId: true,
   name: true,
   entityType: true,
   imageUrl: true,
   tags: true,
} as const;

/** Saved profiles by user id (oldest entity first, as Taste Profile lists them). */
async function loadProfiles(userIds: string[]): Promise<Map<string, ProfileEntity[]>> {
   const out = new Map<string, ProfileEntity[]>();
   if (userIds.length === 0) return out;
   const rows = await db.userTasteEntity.findMany({
      where: { userId: { in: userIds } },
      select: ENTITY_SELECT,
      orderBy: [{ createdAt: 'asc' }, { name: 'asc' }],
   });
   for (const r of rows) {
      const list = out.get(r.userId) ?? [];
      list.push({
         qloo_entity_id: r.qlooEntityId,
         name: r.name,
         entity_type: r.entityType,
         image_url: r.imageUrl,
         tags: readTags(r.tags),
      });
      out.set(r.userId, list);
   }
   return out;
}

/** Live users (not deleted, active account) with an active taste profile. */
async function activePeers(excludeId: string): Promise<string[]> {
   const counts = await db.userTasteEntity.groupBy({
      by: ['userId'],
      where: { userId: { not: excludeId } },
      _count: { _all: true },
      having: { userId: { _count: { gte: MIN_ACTIVE_ENTITIES } } },
   });
   if (counts.length === 0) return [];
   const users = await db.user.findMany({
      where: { id: { in: counts.map((c) => c.userId) }, deletedAt: null, isActive: true },
      select: { id: true },
      orderBy: [{ tasteUpdatedAt: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }],
      take: PEER_LIMIT,
   });
   return users.map((u) => u.id);
}

function rowData(me: string, other: string, r: PairResult, computedAt: Date) {
   return {
      ...pairIds(me, other),
      score: r.score,
      method: COMPAT_METHOD,
      sharedEntities: r.shared_entities as unknown as Prisma.InputJsonValue,
      sharedTags: r.shared_tags as unknown as Prisma.InputJsonValue,
      stale: false,
      computedAt,
   };
}

async function refreshMatchesFor(userId: string): Promise<number> {
   // Only listings with wants can have matches.
   const items = await db.item.findMany({
      where: { userId, status: 'available', deletedAt: null, wants: { some: {} } },
      select: { id: true },
   });
   for (const i of items) await queueMatchRefresh(i.id, 'taste_profile');
   return items.length;
}

export type TasteCompatResult =
   | { outcome: 'inactive'; removed: number; matchRefreshes: number }
   | { outcome: 'computed'; compared: number; stored: number; matchRefreshes: number; ms: number };

/**
 * Recompute every pair for `userId` (FLOW §10.12): an inactive profile
 * loses its rows; otherwise compare with up to PEER_LIMIT active profiles
 * and keep pairs at COMPAT_MIN or above. After a profile change, also
 * refresh the user's matches (T and O read the profile).
 */
export async function runTasteCompat(
   userId: string,
   { refreshMatches = false }: { refreshMatches?: boolean } = {},
): Promise<TasteCompatResult> {
   const started = Date.now();
   const user = await db.user.findUnique({
      where: { id: userId },
      select: { deletedAt: true, isActive: true },
   });
   const mine = (await loadProfiles([userId])).get(userId) ?? [];
   const involving = { OR: [{ userAId: userId }, { userBId: userId }] };

   if (!user || user.deletedAt || !user.isActive || mine.length < MIN_ACTIVE_ENTITIES) {
      const { count } = await db.tasteCompatibility.deleteMany({ where: involving });
      const matchRefreshes = refreshMatches && user && !user.deletedAt ? await refreshMatchesFor(userId) : 0;
      return { outcome: 'inactive', removed: count, matchRefreshes };
   }

   const peers = await activePeers(userId);
   const profiles = await loadProfiles(peers);
   const computedAt = new Date();
   const rows: ReturnType<typeof rowData>[] = [];
   for (const other of peers) {
      const r = compareProfiles(mine, profiles.get(other) ?? []);
      if (r && r.score >= COMPAT_MIN) rows.push(rowData(userId, other, r, computedAt));
   }

   await db.$transaction(async (tx) => {
      await tx.tasteCompatibility.deleteMany({ where: involving });
      if (rows.length > 0) await tx.tasteCompatibility.createMany({ data: rows });
   });

   const matchRefreshes = refreshMatches ? await refreshMatchesFor(userId) : 0;
   return {
      outcome: 'computed',
      compared: peers.length,
      stored: rows.length,
      matchRefreshes,
      ms: Date.now() - started,
   };
}

export type PairRead =
   | { ok: true; pair: PairResult | null }
   | { ok: false; reason: 'profile_inactive_self' | 'profile_inactive_other' };

/**
 * The stored pair for two users, or computed inline (and stored) when it is
 * missing or stale. `pair` is null when they share too little to store.
 */
export async function readPair(callerId: string, otherId: string): Promise<PairRead> {
   const ids = pairIds(callerId, otherId);
   const [counts, stored] = await Promise.all([
      db.userTasteEntity.groupBy({
         by: ['userId'],
         where: { userId: { in: [callerId, otherId] } },
         _count: { _all: true },
      }),
      db.tasteCompatibility.findUnique({
         where: { userAId_userBId: ids },
         select: { score: true, sharedEntities: true, sharedTags: true, stale: true },
      }),
   ]);
   const count = (id: string) => counts.find((c) => c.userId === id)?._count._all ?? 0;
   if (count(callerId) < MIN_ACTIVE_ENTITIES) return { ok: false, reason: 'profile_inactive_self' };
   if (count(otherId) < MIN_ACTIVE_ENTITIES) return { ok: false, reason: 'profile_inactive_other' };

   if (stored && !stored.stale) {
      return {
         ok: true,
         pair: {
            score: Number(stored.score),
            shared_entities: readShared(stored.sharedEntities),
            shared_tags: readTags(stored.sharedTags),
         },
      };
   }

   const profiles = await loadProfiles([callerId, otherId]);
   const r = compareProfiles(profiles.get(callerId) ?? [], profiles.get(otherId) ?? []);
   if (!r || r.score < COMPAT_MIN) {
      await db.tasteCompatibility.deleteMany({ where: ids });
      return { ok: true, pair: null };
   }
   const data = rowData(callerId, otherId, r, new Date());
   await db.tasteCompatibility.upsert({
      where: { userAId_userBId: ids },
      create: data,
      update: data,
   });
   return { ok: true, pair: r };
}
