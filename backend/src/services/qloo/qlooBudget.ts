import type { QlooPurpose } from './qlooTypes';

export type BudgetVerdict =
   | { allowed: true; probe: boolean }
   | { allowed: false; reason: 'budget_soft' | 'budget_hard' };

export const STALE_READING_MS = 60 * 60 * 1000;

export interface BudgetInput {
   remaining: number | null;
   readingUpdatedAtMs: number | null;
   nowMs: number;
   purpose: QlooPurpose;
   softStop: number;
   hardStop: number;
   /** When this process last let a probe through (null = never). */
   lastProbeAtMs: number | null;
}

/**
 * Section 10.4 budget guard.
 *   remaining <= hardStop: nothing calls Qloo (cached reads still work).
 *   remaining <= softStop: background jobs stop; interactive may continue.
 *
 * The remaining count only changes when we call Qloo, so a blocked client
 * would never learn that the monthly allowance reset. To avoid that, when a
 * block is based on a reading older than an hour, one probe call per hour per
 * process is allowed through to refresh it.
 */
export function decideBudget(i: BudgetInput): BudgetVerdict {
   if (i.remaining === null) return { allowed: true, probe: false };

   let reason: 'budget_soft' | 'budget_hard' | null = null;
   if (i.remaining <= i.hardStop) reason = 'budget_hard';
   else if (i.remaining <= i.softStop && i.purpose === 'background') reason = 'budget_soft';
   if (reason === null) return { allowed: true, probe: false };

   const stale = i.readingUpdatedAtMs === null || i.nowMs - i.readingUpdatedAtMs >= STALE_READING_MS;
   const probeFree = i.lastProbeAtMs === null || i.nowMs - i.lastProbeAtMs >= STALE_READING_MS;
   if (stale && probeFree) return { allowed: true, probe: true };

   return { allowed: false, reason };
}

export function parseRemainingHeader(value: string | null): number | null {
   if (value === null) return null;
   const n = Number(value.trim());
   return Number.isInteger(n) && n >= 0 ? n : null;
}
