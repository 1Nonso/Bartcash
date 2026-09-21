import { db } from '../config/db.config';

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
