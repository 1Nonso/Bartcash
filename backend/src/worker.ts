import 'dotenv/config';
import { db } from './config/db.config';
import {
   boss,
   startQueue,
} from './config/queue.config';
import { QUEUES } from './queue/queue.names';
import { runItemValuation } from './services/valuation.service';
import type { ItemValuationJobData } from './queue/itemValuation.queue';

async function main() {
   await startQueue();

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
                        failedReason: (
                           err as Error
                        ).message,
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
      'Worker started, listening for jobs...',
   );
}

main().catch((err) => {
   console.error(
      'Worker failed to start',
      err,
   );
   process.exit(1);
});
