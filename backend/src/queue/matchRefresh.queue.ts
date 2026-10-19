import {
   boss,
   startQueue,
} from '../config/queue.config';
import { QUEUES } from './queue.names';

export interface MatchRefreshJobData {
   itemId: string;
}

// Returns the job id, or null when pg-boss collapsed it into an
// existing queued job (singleton key).
export async function enqueueMatchRefresh(
   data: MatchRefreshJobData,
) {
   await startQueue();
   return boss.send(
      QUEUES.MATCH_REFRESH,
      data,
      {
         singletonKey: data.itemId,
         retryLimit: 2,
         retryDelay: 10,
         retryBackoff: true,
      },
   );
}
