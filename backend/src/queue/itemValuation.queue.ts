import {
   boss,
   startQueue,
} from '../config/queue.config';
import { QUEUES } from './queue.names';

export interface ItemValuationJobData {
   itemId: string;
   valuationId: string;
}

export async function enqueueItemValuation(
   data: ItemValuationJobData,
) {
   await startQueue();
   await boss.send(
      QUEUES.ITEM_VALUATION,
      data,
      {
         retryLimit: 3,
         retryDelay: 5,
         retryBackoff: true,
      },
   );
}
