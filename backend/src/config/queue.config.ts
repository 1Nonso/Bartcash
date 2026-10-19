import { PgBoss } from 'pg-boss';
import { QUEUES } from '../queue/queue.names';

export const boss = new PgBoss({
   connectionString:
      process.env.DATABASE_URL!,
});

let started = false;

boss.on('error', (err) =>
   console.error('pg-boss error:', err),
);
process.on('SIGTERM', async () => {
   await boss.stop({
      graceful: true,
   });
   process.exit(0);
});

export async function startQueue(): Promise<PgBoss> {
   if (!started) {
      await boss.start();
      await boss.createQueue(
         QUEUES.ITEM_VALUATION,
      );
      await boss.createQueue(
         QUEUES.ITEM_TASTE,
         { policy: 'short' },
      );
      await boss.createQueue(
         QUEUES.MATCH_REFRESH,
         { policy: 'short' },
      );
      started = true;
   }
   return boss;
}
