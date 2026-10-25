import {
   boss,
   startQueue,
} from '../config/queue.config';
import { QUEUES } from './queue.names';

export interface TasteCompatJobData {
   userId: string;
   /** True after a profile change: also refresh the user's matches. */
   refreshMatches: boolean;
}

// Returns the job id, or null when pg-boss collapsed it into an
// existing queued job (singleton key). A profile change has its own key so
// it is never swallowed by a queued read refresh (which skips matches).
export async function enqueueTasteCompat(
   data: TasteCompatJobData,
) {
   await startQueue();
   return boss.send(
      QUEUES.TASTE_COMPAT,
      data,
      {
         singletonKey: `${data.userId}:${data.refreshMatches ? 'profile' : 'read'}`,
         retryLimit: 2,
         retryDelay: 10,
         retryBackoff: true,
      },
   );
}
