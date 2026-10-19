import { boss } from '../config/queue.config';
import { isQlooEnabled } from '../config/features.config';
import { QUEUES } from './queue.names';
import { db } from '../config/db.config';
import { queueMatchRefresh } from '../services/matchRefresh.service';
import {
   enqueueItemTaste,
   type ItemTasteJobData,
} from './itemTaste.queue';
import {
   GroqRetryableError,
   markItemTasteFailed,
   QlooFatalError,
   QlooRetryableError,
   runItemTaste,
   type RunResult,
} from '../services/itemTasteJob.service';

/** No retry for a request that would fail again, or after the last attempt. */
export function shouldGiveUp(
   err: unknown,
   retryCount: number,
   retryLimit: number,
): boolean {
   return (
      err instanceof QlooFatalError ||
      retryCount >= retryLimit
   );
}

// Our errors carry a reason code (qloo_timeout, groq_http_429); any other
// message could hold data, so only its name is logged.
function reasonCode(err: unknown): string {
   return err instanceof QlooRetryableError ||
      err instanceof QlooFatalError ||
      err instanceof GroqRetryableError
      ? err.message
      : (err as Error)?.name ?? 'Error';
}

// Logs the item id and outcome only (no titles, user ids or the key).
function logOutcome(
   itemId: string,
   r: RunResult,
) {
   const extra =
      r.outcome === 'skipped'
         ? ''
         : ` source=${r.source}${r.groq ? ` groq=${r.groq}` : ''}`;
   console.log(
      `item-taste: item ${itemId} ${r.outcome}${extra}`,
   );
}

// Registers the item-taste consumer on the shared pg-boss instance.
// Call after startQueue(). Used by both server.ts and worker.ts.
export async function registerItemTasteWorker() {
   await boss.work<
      ItemTasteJobData,
      void,
      { includeMetadata: true }
   >(
      QUEUES.ITEM_TASTE,
      { includeMetadata: true } as const,
      async ([job]) => {
         if (!job) return;
         const { itemId } = job.data;
         if (!isQlooEnabled()) {
            console.log(
               `item-taste: item ${itemId} skipped (flag off)`,
            );
            return;
         }

         let result: RunResult;
         try {
            // Last attempt: a busy Groq on mapping keeps the tag-only
            // result instead of failing the job.
            result = await runItemTaste(itemId, null, {
               lastAttempt:
                  job.retryCount >= job.retryLimit,
            });
         } catch (err) {
            if (
               !shouldGiveUp(
                  err,
                  job.retryCount,
                  job.retryLimit,
               )
            ) {
               console.warn(
                  `item-taste: item ${itemId} retrying (${reasonCode(err)})`,
               );
               throw err;
            }
            result =
               await markItemTasteFailed(
                  itemId,
                  (err as Error).message,
               );
         }
         logOutcome(itemId, result);

         // New suggestions change tier 2; drafts get matches on publish.
         if (result.outcome !== 'skipped') {
            const item = await db.item.findUnique({
               where: { id: itemId },
               select: { status: true },
            });
            if (item?.status === 'available') {
               await queueMatchRefresh(itemId, 'taste_done');
            }
         }

         // Edited while this run was in progress: run once more.
         if (
            result.outcome !== 'skipped' &&
            result.changedDuringRun
         ) {
            await enqueueItemTaste({
               itemId,
            });
         }
      },
   );

   console.log(
      'Item-taste worker registered, listening for jobs...',
   );
}
