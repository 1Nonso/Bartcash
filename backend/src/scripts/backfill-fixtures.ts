// ============================================================================
// Item-taste backfill selection tests (Phase 3 step 5). Pure, no database:
//
//   npx tsx src/scripts/backfill-fixtures.ts
// ============================================================================
import assert from 'node:assert/strict';
import {
   checkBackfillBudget,
   MAX_QLOO_CALLS_PER_JOB,
   selectBackfill,
   type BackfillRow,
} from '../services/itemTasteBackfill.service';

const rows: BackfillRow[] = [
   { id: 'none', isService: false, tasteStatus: null },
   { id: 'failed', isService: false, tasteStatus: 'failed' },
   { id: 'resolved', isService: false, tasteStatus: 'resolved' },
   { id: 'unresolved', isService: false, tasteStatus: 'unresolved' },
   { id: 'pending', isService: false, tasteStatus: 'pending' },
   { id: 'service', isService: true, tasteStatus: null },
];

const tests: [string, () => void][] = [];
const test = (name: string, fn: () => void) => tests.push([name, fn]);

test('Default: no row and failed only, in input order', () => {
   const plan = selectBackfill(rows);
   assert.deepEqual(plan.eligible, ['none', 'failed', 'service']);
   assert.deepEqual(plan.counts, { noRow: 2, failed: 1, rerun: 0, services: 1 });
   assert.deepEqual(plan.skipped, { resolved: 1, unresolved: 1, pending: 1 });
});

test('Services cost 0 Qloo calls, others the per-job maximum', () => {
   assert.equal(selectBackfill(rows).worstCaseCalls, 2 * MAX_QLOO_CALLS_PER_JOB);
});

test('force: everything, re-runs counted', () => {
   const plan = selectBackfill(rows, { force: true });
   assert.equal(plan.eligible.length, rows.length);
   assert.deepEqual(plan.counts, { noRow: 2, failed: 1, rerun: 3, services: 1 });
   assert.deepEqual(plan.skipped, {});
   assert.equal(plan.worstCaseCalls, 5 * MAX_QLOO_CALLS_PER_JOB);
});

test('Empty input: nothing eligible, 0 calls', () => {
   const plan = selectBackfill([]);
   assert.deepEqual(plan.eligible, []);
   assert.equal(plan.worstCaseCalls, 0);
});

test('Budget: must stay at or above the reserve; unknown reading allowed', () => {
   assert.deepEqual(checkBackfillBudget(30, 1030, 1000), { ok: true, remainingAfter: 1000 });
   assert.deepEqual(checkBackfillBudget(31, 1030, 1000), { ok: false, remainingAfter: 999 });
   assert.deepEqual(checkBackfillBudget(30, null, 1000), { ok: true, remainingAfter: null });
});

let failed = 0;
for (const [name, fn] of tests) {
   try {
      fn();
      console.log(`PASS  ${name}`);
   } catch (err) {
      failed++;
      console.log(`FAIL  ${name}\n      ${(err as Error).message}`);
   }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed > 0 ? 1 : 0);
