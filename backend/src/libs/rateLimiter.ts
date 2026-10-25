import type { Request } from 'express';
import { db } from '../config/db.config';
import {
   rateLimit,
   ipKeyGenerator,
   MINUTE,
} from 'express-rate-limit';

// One bucket per user (IP when signed out) per route, so limits on
// different routes don't share a counter.
function routeKey(req: Request): string {
   const who =
      req.userId ??
      ipKeyGenerator(req.ip ?? '');
   const route = `${req.method} ${req.baseUrl}${req.route?.path ?? req.path}`;
   return `${who}|${route}`;
}

/** Per-user, per-route limiter (D-19). Planned tiers: taste search 30,
 *  Scout draft-offer 10, everything else 60 per minute. */
export function userLimiter(
   limit: number,
   windowMs = 1 * MINUTE,
) {
   return rateLimit({
      windowMs,
      limit,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      keyGenerator: routeKey,
      message: {
         success: false,
         message:
            'Too many requests. Please try again shortly.',
      },
   });
}

export const limiter = userLimiter(10);

export async function hit(
   key: string,
   windowSeconds: number,
): Promise<number> {
   const now = new Date();
   const existing =
      await db.rateLimitAttempt.findFirst(
         { where: { key } },
      );

   if (
      !existing ||
      existing.expiresAt.getTime() <
         Date.now()
   ) {
      const expiresAt = new Date(
         Date.now() +
            windowSeconds * 1000,
      );
      const row =
         await db.rateLimitAttempt.upsert(
            {
               where: { key },
               create: {
                  key,
                  count: 1,
                  windowStart: now,
                  expiresAt,
               },
               update: {
                  count: 1,
                  windowStart: now,
                  expiresAt,
               },
            },
         );
      return row.count;
   }

   const updated =
      await db.rateLimitAttempt.update({
         where: { key },
         data: {
            count: existing.count + 1,
         },
      });
   return updated.count;
}

export async function tooManyAttempts(
   key: string,
   max: number,
): Promise<boolean> {
   const existing =
      await db.rateLimitAttempt.findFirst(
         { where: { key } },
      );
   if (
      !existing ||
      existing.expiresAt.getTime() <
         Date.now()
   )
      return false;
   return existing.count >= max;
}

export async function availableInSeconds(
   key: string,
): Promise<number> {
   const existing =
      await db.rateLimitAttempt.findFirst(
         { where: { key } },
      );
   if (!existing) return 0;
   return Math.max(
      0,
      Math.ceil(
         (existing.expiresAt.getTime() -
            Date.now()) /
            1000,
      ),
   );
}

export async function clear(
   key: string,
): Promise<void> {
   await db.rateLimitAttempt.deleteMany(
      { where: { key } },
   );
}
