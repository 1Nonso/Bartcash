import {
   boss,
   startQueue,
} from '../config/queue.config';
import { QUEUES } from './queue.names';

export interface ItemTasteJobData {
   itemId: string;
}

// Returns the job id, or null when pg-boss collapsed it into an
// existing queued job (singleton key).
export async function enqueueItemTaste(
   data: ItemTasteJobData,
) {
   await startQueue();
   return boss.send(
      QUEUES.ITEM_TASTE,
      data,
      {
         singletonKey: data.itemId,
         retryLimit: 3,
         retryDelay: 10,
         retryBackoff: true,
      },
   );
}
