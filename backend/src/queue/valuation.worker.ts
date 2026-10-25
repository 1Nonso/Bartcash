import { db } from '../config/db.config';
import { boss } from '../config/queue.config';
import { QUEUES } from './queue.names';
import { runItemValuation } from '../services/valuation.service';
import type { ItemValuationJobData } from './itemValuation.queue';
import { valuationFailureCode } from '../utils/valuationFailure';

// Registers the item-valuation consumer on the shared pg-boss instance.
// Call after startQueue(). Used by both server.ts (in-process, free hosting)
// and worker.ts (standalone process).
export async function registerValuationWorker() {
   await boss.work<
      ItemValuationJobData,
      void,
      { includeMetadata: true }
   >(
      QUEUES.ITEM_VALUATION,
      {
         includeMetadata: true,
      } as const,
      async ([job]) => {
         if (!job) return;
         const { itemId, valuationId } =
            job.data;

         try {
            await runItemValuation(
               itemId,
               valuationId,
            );
         } catch (err) {
            const isFinalAttempt =
               job.retryCount >=
               job.retryLimit;

            if (isFinalAttempt) {
               await db.itemValuation.update(
                  {
                     where: { itemId },
                     data: {
                        status:
                           'failed',
                        // A code, never the raw text (Groq's names the org).
                        failedReason:
                           valuationFailureCode(
                              (err as Error)
                                 ?.message,
                           ),
                     },
                  },
               );
               return;
            }
            throw err;
         }
      },
   );

   console.log(
      'Valuation worker registered, listening for jobs...',
   );
}
