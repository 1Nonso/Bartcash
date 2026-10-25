import { PgBoss } from 'pg-boss';
import { QUEUES } from '../queue/queue.names';

// Pool kept small to share Supabase's 15 connections with Prisma
// (see PRISMA_POOL_MAX in db.config.ts).
export const BOSS_POOL_MAX = 4;

export const boss = new PgBoss({
   connectionString:
      process.env.DATABASE_URL!,
   max: BOSS_POOL_MAX,
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
      await boss.createQueue(
         QUEUES.TASTE_COMPAT,
         { policy: 'short' },
      );
      started = true;
   }
   return boss;
}
