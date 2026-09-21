import { PgBoss } from 'pg-boss';
import { QUEUES } from '../queue/queue.names';

export const boss = new PgBoss({
   connectionString:
      process.env.DATABASE_URL!,
});

let started = false;

export async function startQueue(): Promise<PgBoss> {
   if (!started) {
      await boss.start();
      await boss.createQueue(
         QUEUES.ITEM_VALUATION,
      );
      started = true;
   }
   return boss;
}
