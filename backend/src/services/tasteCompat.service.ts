// Taste compatibility reads (API §16.4): GET /taste/compatible-users and
// GET /users/:id/taste-compatibility, plus queueing the taste-compat job.
// Database only; never calls Qloo.

import z from 'zod';
import { db } from '../config/db.config';
import { isQlooEnabled } from '../config/features.config';
import { enqueueTasteCompat } from '../queue/tasteCompat.queue';
import { formatItemCard, formatOwner } from '../utils/itemFormat';
import { takeReadRefreshSlot } from './matchRefresh.service';
import { MIN_ACTIVE_ENTITIES } from './tasteSummary';
import { readPair } from './tasteCompatJob.service';
import {
   COMPAT_MIN,
   formatCompatibility,
   rankPreviews,
   readRelated,
   readShared,
   readTags,
   type ViewerTaste,
} from './tasteCompat';

export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 20;
export const PREVIEW_ITEMS = 3;
/** Pairs older than this are recomputed on the next read. */
export const COMPAT_STALE_HOURS = 24;
/** After a profile save with no rows yet, report refreshing this long. */
export const FIRST_RUN_WINDOW_MS = 20_000;

const lastReadRun = new Map<string, number>();

/**
 * Best-effort enqueue; never throws. A profile change always queues; reads
 * queue at most once per user per hour (per process). True when queued or
 * already queued.
 */
export async function queueTasteCompat(userId: string, trigger: 'profile' | 'read'): Promise<boolean> {
   if (!isQlooEnabled()) return false;
   if (trigger === 'read' && !takeReadRefreshSlot(userId, Date.now(), lastReadRun)) return false;
   try {
      const jobId = await enqueueTasteCompat({ userId, refreshMatches: trigger === 'profile' });
      // Job id only: never log user ids.
      console.log(`taste-compat: ${jobId ? `job ${jobId} queued` : 'already queued'} (${trigger})`);
      return true;
   } catch (err) {
      console.error('taste-compat: enqueue failed:', (err as Error).message);
      return false;
   }
}

export const compatibleUsersQuerySchema = z.object({
   cursor: z
      .string()
      .regex(/^\d{1,6}$/, 'Enter a valid cursor.')
      .optional(),
   limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
});

/** Live account with at least one available listing. */
const liveWithListing = {
   deletedAt: null,
   isActive: true,
   items: { some: { status: 'available', deletedAt: null } },
};

const OWNER_SELECT = {
   id: true,
   firstName: true,
   lastName: true,
   profilePhoto: true,
   averageRating: true,
} as const;

export type CompatibleUsersResult =
   | { ok: false; code: 'TASTE_PROFILE_INACTIVE' }
   | {
        ok: true;
        data: {
           items: {
              user: ReturnType<typeof formatOwner>;
              compatibility: ReturnType<typeof formatCompatibility>;
              listings_preview: ReturnType<typeof formatItemCard>[];
           }[];
           next_cursor: string | null;
           meta: { status: 'ready' | 'refreshing' | 'empty' };
        };
     };

export async function getCompatibleUsers(
   callerId: string,
   { cursor, limit }: { cursor?: string | undefined; limit: number },
): Promise<CompatibleUsersResult> {
   const [entityCount, me] = await Promise.all([
      db.userTasteEntity.count({ where: { userId: callerId } }),
      db.user.findUnique({ where: { id: callerId }, select: { tasteUpdatedAt: true } }),
   ]);
   if (entityCount < MIN_ACTIVE_ENTITIES) return { ok: false, code: 'TASTE_PROFILE_INACTIVE' };

   const offset = cursor ? Number(cursor) : 0;
   const where = {
      score: { gte: COMPAT_MIN },
      OR: [
         { userAId: callerId, userB: liveWithListing },
         { userBId: callerId, userA: liveWithListing },
      ],
   };
   const [rows, all] = await Promise.all([
      db.tasteCompatibility.findMany({
         where,
         orderBy: [{ score: 'desc' }, { id: 'asc' }],
         skip: offset,
         take: limit + 1,
         select: {
            userAId: true,
            score: true,
            sharedEntities: true,
            userA: { select: OWNER_SELECT },
            userB: { select: OWNER_SELECT },
         },
      }),
      db.tasteCompatibility.aggregate({
         where: { OR: [{ userAId: callerId }, { userBId: callerId }] },
         _count: { _all: true },
         _min: { computedAt: true },
      }),
   ]);
   const anyStale =
      (await db.tasteCompatibility.count({
         where: { stale: true, OR: [{ userAId: callerId }, { userBId: callerId }] },
      })) > 0;

   // Refresh: no rows yet, any stale, or older than COMPAT_STALE_HOURS.
   const none = all._count._all === 0;
   const old =
      all._min.computedAt !== null &&
      Date.now() - all._min.computedAt.getTime() > COMPAT_STALE_HOURS * 3600_000;
   if (none || anyStale || old) await queueTasteCompat(callerId, 'read');

   const page = rows.slice(0, limit);
   const others = page.map((r) => (r.userAId === callerId ? r.userB : r.userA));
   const [previews, viewer] = await Promise.all([
      db.item.findMany({
         where: { userId: { in: others.map((o) => o.id) }, status: 'available', deletedAt: null },
         orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
         include: {
            images: { where: { isPrimary: true }, take: 1 },
            valuation: true,
            user: true,
            taste: { select: { status: true, qlooEntityId: true, tags: true, relatedEntities: true } },
         },
      }),
      loadViewerTaste(callerId),
   ]);
   // Listings that fit the caller's taste first (stored data, no Qloo call).
   const ranked = rankPreviews(
      previews.map((p) => {
         const resolved = p.taste?.status === 'resolved';
         return {
            ...p,
            entityId: resolved ? (p.taste?.qlooEntityId ?? null) : null,
            tags: resolved ? readTags(p.taste?.tags) : [],
            related: resolved ? readRelated(p.taste?.relatedEntities) : [],
         };
      }),
      viewer,
   );

   const items = page.map((r, i) => {
      const other = others[i]!;
      return {
         user: formatOwner(other),
         compatibility: formatCompatibility({
            score: Number(r.score),
            shared_entities: readShared(r.sharedEntities),
         }),
         listings_preview: ranked
            .filter((p) => p.userId === other.id)
            .slice(0, PREVIEW_ITEMS)
            .map(formatItemCard),
      };
   });

   const justSaved =
      none && me?.tasteUpdatedAt != null && Date.now() - me.tasteUpdatedAt.getTime() < FIRST_RUN_WINDOW_MS;
   const status = anyStale || justSaved ? 'refreshing' : items.length === 0 && offset === 0 ? 'empty' : 'ready';

   return {
      ok: true,
      data: {
         items,
         next_cursor: rows.length > limit ? String(offset + limit) : null,
         meta: { status },
      },
   };
}

/** The caller's interest ids and pooled tag ids. */
async function loadViewerTaste(userId: string): Promise<ViewerTaste> {
   const rows = await db.userTasteEntity.findMany({
      where: { userId },
      select: { qlooEntityId: true, tags: true },
   });
   return {
      entityIds: new Set(rows.map((r) => r.qlooEntityId)),
      tagIds: new Set(rows.flatMap((r) => readTags(r.tags).map((t) => t.tag_id))),
   };
}

export type PairCompatResult =
   | { ok: false; status: 404 | 422; message: string }
   | {
        ok: true;
        data: {
           compatibility: ReturnType<typeof formatCompatibility> | null;
           reason: 'profile_inactive_self' | 'profile_inactive_other' | null;
        };
     };

/** GET /users/:id/taste-compatibility: only what the two share. */
export async function getPairCompatibility(callerId: string, otherId: string): Promise<PairCompatResult> {
   if (otherId === callerId) return { ok: false, status: 422, message: 'You cannot compare with yourself.' };
   const other = await db.user.findUnique({ where: { id: otherId }, select: { deletedAt: true } });
   if (!other || other.deletedAt) return { ok: false, status: 404, message: 'User not found.' };

   const r = await readPair(callerId, otherId);
   if (!r.ok) return { ok: true, data: { compatibility: null, reason: r.reason } };
   return {
      ok: true,
      data: {
         compatibility: r.pair ? formatCompatibility(r.pair, { withTags: true }) : null,
         reason: null,
      },
   };
}
