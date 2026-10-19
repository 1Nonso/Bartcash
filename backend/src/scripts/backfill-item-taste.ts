// ============================================================================
// One-off item-taste backfill (Phase 3 step 5; DB §10.12). Queues the
// item-taste job for available listings so they gain want suggestions.
//
//   npm run backfill                    dry run: counts only, queues nothing
//   npm run backfill -- --run           queue (needs QLOO_ENABLED=true)
//   npm run backfill -- --run --force   also re-run resolved/unresolved/pending
//   --force-budget                      ignore the 1,000-call reserve check
//
// Queues at most 3 per second. Logs item ids and outcomes only.
// ============================================================================
import 'dotenv/config';
import { db } from '../config/db.config';
import { isQlooEnabled } from '../config/features.config';
import { qlooConfig } from '../config/qloo.config';
import { boss } from '../config/queue.config';
import {
   checkBackfillBudget,
   ENQUEUE_INTERVAL_MS,
   selectBackfill,
} from '../services/itemTasteBackfill.service';
import {
   requestItemTaste,
   type QueueOutcome,
} from '../services/itemTaste.service';
import { QLOO_USAGE_ROW_ID } from '../services/qloo/qlooStores';

const args = new Set(process.argv.slice(2));
const run = args.has('--run');
const force = args.has('--force');
const forceBudget = args.has('--force-budget');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<number> {
   const items = await db.item.findMany({
      where: { status: 'available', deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true, isService: true, taste: { select: { status: true } } },
   });
   const plan = selectBackfill(
      items.map((i) => ({
         id: i.id,
         isService: i.isService,
         tasteStatus: i.taste?.status ?? null,
      })),
      { force },
   );
   const usage = await db.qlooUsage.findUnique({
      where: { id: QLOO_USAGE_ROW_ID },
      select: { remainingReported: true },
   });
   const remaining = usage?.remainingReported ?? null;
   const reserve = qlooConfig.budgetSoftStop;
   const budget = checkBackfillBudget(plan.worstCaseCalls, remaining, reserve);

   console.log(`backfill: ${run ? 'RUN' : 'DRY RUN'}${force ? ' (force)' : ''}`);
   console.log(`  available items:   ${items.length}`);
   console.log(
      `  eligible:          ${plan.eligible.length} (no row ${plan.counts.noRow}, ` +
         `failed ${plan.counts.failed}, re-run ${plan.counts.rerun}; ` +
         `services ${plan.counts.services})`,
   );
   const skipped = Object.entries(plan.skipped)
      .map(([s, n]) => `${s} ${n}`)
      .join(', ');
   console.log(`  skipped:           ${skipped || 'none'}`);
   console.log(`  worst-case Qloo:   ${plan.worstCaseCalls} calls`);
   console.log(
      `  remaining (month): ${remaining ?? 'unknown'}; reserve ${reserve}; ` +
         `after worst case ${budget.remainingAfter ?? 'unknown'}`,
   );
   console.log(`  time to queue:     ~${Math.ceil((plan.eligible.length * ENQUEUE_INTERVAL_MS) / 1000)} s`);

   if (!run) {
      console.log('\nDry run only. Add --run to queue.');
      return 0;
   }
   if (!isQlooEnabled()) {
      console.error('\nQLOO_ENABLED is off: nothing would be queued. Aborting.');
      return 1;
   }
   if (!budget.ok && !forceBudget) {
      console.error(
         `\nWorst case would leave ${budget.remainingAfter} calls, below the ` +
            `${reserve} reserve. Aborting (--force-budget overrides).`,
      );
      return 1;
   }
   if (plan.eligible.length === 0) {
      console.log('\nNothing to queue.');
      return 0;
   }

   console.log('');
   const totals: Record<QueueOutcome, number> = {
      queued: 0,
      already_queued: 0,
      failed: 0,
      disabled: 0,
   };
   for (const [i, id] of plan.eligible.entries()) {
      if (i > 0) await sleep(ENQUEUE_INTERVAL_MS);
      const outcome = await requestItemTaste(id, { reset: true });
      totals[outcome]++;
      console.log(`backfill: item ${id} ${outcome}`);
   }
   console.log(
      `\nDone: queued ${totals.queued}, already queued ${totals.already_queued}, ` +
         `failed ${totals.failed}. The worker processes them.`,
   );
   return totals.failed > 0 ? 1 : 0;
}

main()
   .then(async (code) => {
      if (run) await boss.stop({ graceful: true }).catch(() => {});
      await db.$disconnect();
      process.exit(code);
   })
   .catch(async (err) => {
      console.error('backfill failed:', (err as Error).message);
      await db.$disconnect();
      process.exit(1);
   });
