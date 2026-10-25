import { db } from '../config/db.config';
import { isQlooEnabled } from '../config/features.config';
import { enqueueItemTaste } from '../queue/itemTaste.queue';

// What an enqueue attempt did (the backfill script counts these).
export type QueueOutcome =
   | 'queued'
   | 'already_queued'
   | 'failed'
   | 'disabled';

// Best-effort enqueue. Never throws, so it can never fail a request.
// Logs the item id only.
export async function queueItemTaste(
   itemId: string,
): Promise<QueueOutcome> {
   if (!isQlooEnabled()) return 'disabled';
   try {
      const jobId =
         await enqueueItemTaste({
            itemId,
         });
      if (!jobId) {
         console.log(
            `item-taste: job already queued for item ${itemId}`,
         );
         return 'already_queued';
      }
      return 'queued';
   } catch (err) {
      console.error(
         `item-taste: enqueue failed for item ${itemId}:`,
         (err as Error).message,
      );
      return 'failed';
   }
}

// Create the pending row if absent (reset=true also sets an existing row
// back to pending; suggestions and picked wants are left untouched),
// then queue the job.
export async function requestItemTaste(
   itemId: string,
   { reset = false } = {},
): Promise<QueueOutcome> {
   if (!isQlooEnabled()) return 'disabled';
   try {
      await db.itemTaste.upsert({
         where: { itemId },
         create: {
            itemId,
            status: 'pending',
         },
         update: reset
            ? {
                 status: 'pending',
                 failedReason: null,
              }
            : {},
      });
   } catch (err) {
      console.error(
         `item-taste: row upsert failed for item ${itemId}:`,
         (err as Error).message,
      );
   }
   return queueItemTaste(itemId);
}

// Publish trigger: only acts when no row exists yet.
export async function ensureItemTaste(
   itemId: string,
) {
   if (!isQlooEnabled()) return;
   try {
      const existing =
         await db.itemTaste.findUnique({
            where: { itemId },
            select: { id: true },
         });
      if (existing) return;
   } catch (err) {
      console.error(
         `item-taste: lookup failed for item ${itemId}:`,
         (err as Error).message,
      );
      return;
   }
   await requestItemTaste(itemId);
}
