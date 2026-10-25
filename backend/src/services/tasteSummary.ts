// ----------------------------------------------------------------------------
// Taste summary for GET /user/profile (Phase 4b, Section 16.8).
// Pure factory: no database or config imports, so it is testable on its own.
// The wired instance lives in taste.service.ts.
// ----------------------------------------------------------------------------

/** A taste profile is "active" from this many entities (Phase 3, 3.21). */
export const MIN_ACTIVE_ENTITIES = 3;

export interface TasteSummary {
   entityCount: number;
   isActive: boolean;
}

export interface TasteSummaryDeps {
   /** Is the Qloo feature switched on (QLOO_ENABLED)? */
   enabled: () => boolean;
   countEntities: (userId: string) => Promise<number>;
   /** Called when the count fails; the profile response must not. */
   onError?: (err: unknown) => void;
}

export const EMPTY_TASTE_SUMMARY: TasteSummary = { entityCount: 0, isActive: false };

export function createTasteSummary(deps: TasteSummaryDeps) {
   return async function getTasteSummary(userId: string): Promise<TasteSummary> {
      // Flag off: zero cost, zero risk. Nothing is read.
      if (!deps.enabled()) return { ...EMPTY_TASTE_SUMMARY };
      try {
         const entityCount = await deps.countEntities(userId);
         return { entityCount, isActive: entityCount >= MIN_ACTIVE_ENTITIES };
      } catch (err) {
         deps.onError?.(err);
         return { ...EMPTY_TASTE_SUMMARY };
      }
   };
}
