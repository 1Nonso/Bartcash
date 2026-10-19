import { boss } from '../config/queue.config';
import { isQlooEnabled } from '../config/features.config';
import { QUEUES } from './queue.names';
import type { MatchRefreshJobData } from './matchRefresh.queue';
import { runMatchRefresh } from '../services/matchRefreshJob.service';

// Registers the match-refresh consumer on the shared pg-boss instance.
// Call after startQueue(). Used by both server.ts and worker.ts.
// Logs the item id and outcome only. A thrown error is retried (2 retries);
// after the last one the previous rows stay and the next read queues again.
export async function registerMatchRefreshWorker() {
   await boss.work<MatchRefreshJobData>(
      QUEUES.MATCH_REFRESH,
      async ([job]) => {
         if (!job) return;
         const { itemId } = job.data;
         if (!isQlooEnabled()) {
            console.log(`match-refresh: item ${itemId} skipped (flag off)`);
            return;
         }
         const r = await runMatchRefresh(itemId);
         console.log(
            r.outcome === 'cleared'
               ? `match-refresh: item ${itemId} cleared (not available)`
               : `match-refresh: item ${itemId} refreshed rows=${r.count} level=${r.level} taste=${r.taste}`,
         );
      },
   );

   console.log(
      'Match-refresh worker registered, listening for jobs...',
   );
}
