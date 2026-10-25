// ============================================================================
// Item-taste backfill selection (Phase 3 step 5; DB §10.12, FLOW §10.10).
// Pure: decides which available items to queue and the worst-case Qloo cost.
// The script (src/scripts/backfill-item-taste.ts) does the database work.
// ============================================================================

/** Most Qloo calls one job makes: brand search, product search, insights. */
export const MAX_QLOO_CALLS_PER_JOB = 3;
/** Gap between enqueues, so the backfill stays at or under 3 per second. */
export const ENQUEUE_INTERVAL_MS = 334;

export interface BackfillRow {
   id: string;
   isService: boolean;
   /** item_tastes.status, null when the item has no row. */
   tasteStatus: string | null;
}

export interface BackfillPlan {
   /** Item ids to queue, in input order. */
   eligible: string[];
   counts: { noRow: number; failed: number; rerun: number; services: number };
   /** Skipped items per taste status. */
   skipped: Record<string, number>;
   /** Upper bound; cache hits and unbranded items cost less. */
   worstCaseCalls: number;
}

/**
 * Default: items with no row or a failed one. resolved, unresolved (no
 * confident brand, a re-run gives the same fallback) and pending (already
 * queued) are skipped. force re-runs all of them; pg-boss's singleton key
 * collapses a duplicate of a job that is still queued.
 */
export function selectBackfill(
   rows: readonly BackfillRow[],
   { force = false } = {},
): BackfillPlan {
   const plan: BackfillPlan = {
      eligible: [],
      counts: { noRow: 0, failed: 0, rerun: 0, services: 0 },
      skipped: {},
      worstCaseCalls: 0,
   };
   for (const row of rows) {
      const status = row.tasteStatus;
      if (status !== null && status !== 'failed' && !force) {
         plan.skipped[status] = (plan.skipped[status] ?? 0) + 1;
         continue;
      }
      plan.eligible.push(row.id);
      if (status === null) plan.counts.noRow++;
      else if (status === 'failed') plan.counts.failed++;
      else plan.counts.rerun++;
      // Services never call Qloo (status unresolved, fallback suggestions).
      if (row.isService) plan.counts.services++;
      else plan.worstCaseCalls += MAX_QLOO_CALLS_PER_JOB;
   }
   return plan;
}

export type BudgetCheck =
   | { ok: true; remainingAfter: number | null }
   | { ok: false; remainingAfter: number };

/**
 * The backfill must not take the monthly allowance below the reserve (the
 * client's soft stop, 1,000 by default). An unknown reading (no call made
 * yet) is allowed; the client's own budget guard still applies per call.
 */
export function checkBackfillBudget(
   worstCaseCalls: number,
   remaining: number | null,
   reserve: number,
): BudgetCheck {
   if (remaining === null) return { ok: true, remainingAfter: null };
   const remainingAfter = remaining - worstCaseCalls;
   return remainingAfter >= reserve
      ? { ok: true, remainingAfter }
      : { ok: false, remainingAfter };
}
