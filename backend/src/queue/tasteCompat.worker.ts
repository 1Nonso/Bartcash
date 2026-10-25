import { boss } from '../config/queue.config';
import { isQlooEnabled } from '../config/features.config';
import { QUEUES } from './queue.names';
import type { TasteCompatJobData } from './tasteCompat.queue';
import { runTasteCompat } from '../services/tasteCompatJob.service';

// Registers the taste-compat consumer on the shared pg-boss instance.
// Call after startQueue(). Used by both server.ts and worker.ts.
// Logs the user id's job outcome only (counts, never names or interests).
export async function registerTasteCompatWorker() {
   await boss.work<TasteCompatJobData>(
      QUEUES.TASTE_COMPAT,
      async ([job]) => {
         if (!job) return;
         const { userId, refreshMatches } = job.data;
         if (!isQlooEnabled()) {
            console.log(`taste-compat: job ${job.id} skipped (flag off)`);
            return;
         }
         const r = await runTasteCompat(userId, { refreshMatches });
         console.log(
            r.outcome === 'inactive'
               ? `taste-compat: job ${job.id} inactive profile, removed=${r.removed} matches=${r.matchRefreshes}`
               : `taste-compat: job ${job.id} compared=${r.compared} stored=${r.stored} matches=${r.matchRefreshes} ms=${r.ms}`,
         );
      },
   );

   console.log(
      'Taste-compat worker registered, listening for jobs...',
   );
}
