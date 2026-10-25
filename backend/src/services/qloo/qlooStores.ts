import type { CacheStore, UsageReading, UsageStore } from './qlooTypes';

// ----------------------------------------------------------------------------
// Prisma-backed stores for qloo_cache and qloo_usage (Sections 3.24, 3.25).
// Typed structurally so this file does not depend on the generated client's
// path; pass your `db` from src/config/db.config.ts.
// ----------------------------------------------------------------------------

/** qloo_usage holds exactly one row; a fixed id makes upsert race-free. */
export const QLOO_USAGE_ROW_ID = '00000000-0000-0000-0000-000000000001';

export interface QlooDb {
   qlooCache: {
      findUnique(args: {
         where: { cacheKey: string };
      }): PromiseLike<{ response: unknown; expiresAt: Date } | null>;
      upsert(args: {
         where: { cacheKey: string };
         create: { cacheKey: string; endpoint: string; response: never; expiresAt: Date };
         update: { endpoint: string; response: never; expiresAt: Date };
      }): PromiseLike<unknown>;
      deleteMany(args: { where: { expiresAt: { lt: Date } } }): PromiseLike<{ count: number }>;
   };
   qlooUsage: {
      findUnique(args: {
         where: { id: string };
      }): PromiseLike<{
         callsSinceStart: number;
         remainingReported: number | null;
         limitReported: number | null;
         updatedAt: Date;
      } | null>;
      upsert(args: {
         where: { id: string };
         create: {
            id: string;
            callsSinceStart: number;
            remainingReported?: number;
            limitReported?: number;
         };
         update: {
            callsSinceStart: { increment: number };
            remainingReported?: number;
            limitReported?: number;
         };
      }): PromiseLike<unknown>;
   };
}

export function prismaCacheStore(db: QlooDb): CacheStore {
   return {
      async get(key, nowMs) {
         const row = await db.qlooCache.findUnique({ where: { cacheKey: key } });
         if (!row || row.expiresAt.getTime() <= nowMs) return undefined;
         return row.response;
      },
      async set(key, endpoint, value, expiresAtMs) {
         const expiresAt = new Date(expiresAtMs);
         const response = value as never; // normalised, JSON-safe data
         await db.qlooCache.upsert({
            where: { cacheKey: key },
            create: { cacheKey: key, endpoint, response, expiresAt },
            update: { endpoint, response, expiresAt },
         });
      },
   };
}

export function prismaUsageStore(db: QlooDb): UsageStore {
   return {
      async read(): Promise<UsageReading> {
         const row = await db.qlooUsage.findUnique({ where: { id: QLOO_USAGE_ROW_ID } });
         if (!row) return { remaining: null, limit: null, updatedAtMs: null };
         return {
            remaining: row.remainingReported,
            limit: row.limitReported,
            updatedAtMs: row.updatedAt.getTime(),
         };
      },
      async record({ remaining, limit }) {
         // A missing header leaves the stored value as it was.
         const known: { remainingReported?: number; limitReported?: number } = {};
         if (remaining !== null) known.remainingReported = remaining;
         if (limit !== null) known.limitReported = limit;
         await db.qlooUsage.upsert({
            where: { id: QLOO_USAGE_ROW_ID },
            create: { id: QLOO_USAGE_ROW_ID, callsSinceStart: 1, ...known },
            update: { callsSinceStart: { increment: 1 }, ...known },
         });
      },
   };
}

/** Housekeeping for the nightly/maintenance job: remove expired cache rows. */
export async function purgeExpiredQlooCache(db: QlooDb, nowMs: number): Promise<number> {
   const res = await db.qlooCache.deleteMany({ where: { expiresAt: { lt: new Date(nowMs) } } });
   return res.count;
}
