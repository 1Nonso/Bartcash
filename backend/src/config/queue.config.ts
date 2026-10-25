import { PgBoss } from 'pg-boss';
import { QUEUES } from '../queue/queue.names';

// Pool kept small to share Supabase's 15 connections with Prisma
// (see PRISMA_POOL_MAX in db.config.ts).
export const BOSS_POOL_MAX = 3;
/** Start-up retries: during a Render deploy the old instance still holds
 *  its connections for a moment, so the first attempts can hit Supabase's
 *  limit (EMAXCONNSESSION). Retry instead of exiting. */
export const START_RETRY_MS = 5000;
export const START_MAX_WAIT_MS = 120_000;

export const boss = new PgBoss({
   connectionString:
      process.env.DATABASE_URL!,
   max: BOSS_POOL_MAX,
});

let started = false;
let starting: Promise<PgBoss> | null = null;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

boss.on('error', (err) =>
   console.error('pg-boss error:', err),
);
process.on('SIGTERM', async () => {
   await boss.stop({
      graceful: true,
   });
   process.exit(0);
});

async function startOnce(): Promise<void> {
   await boss.start();
   await boss.createQueue(QUEUES.ITEM_VALUATION);
   await boss.createQueue(QUEUES.ITEM_TASTE, { policy: 'short' });
   await boss.createQueue(QUEUES.MATCH_REFRESH, { policy: 'short' });
   await boss.createQueue(QUEUES.TASTE_COMPAT, { policy: 'short' });
}

/** Starts pg-boss once (shared by concurrent callers), retrying for up to
 *  START_MAX_WAIT_MS; throws only after that. */
export async function startQueue(): Promise<PgBoss> {
   if (started) return boss;
   if (!starting) {
      starting = (async () => {
         const deadline = Date.now() + START_MAX_WAIT_MS;
         for (let attempt = 1; ; attempt++) {
            try {
               await startOnce();
               started = true;
               if (attempt > 1) console.log(`queue: started on attempt ${attempt}`);
               return boss;
            } catch (err) {
               if (Date.now() + START_RETRY_MS > deadline) throw err;
               console.warn(
                  `queue: start attempt ${attempt} failed (${(err as { code?: string }).code ?? (err as Error).name}), retrying in ${START_RETRY_MS / 1000}s`,
               );
               await sleep(START_RETRY_MS);
            }
         }
      })().finally(() => {
         starting = null;
      });
   }
   return starting;
}
