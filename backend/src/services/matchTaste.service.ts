// Component T (DB §10.7): one batched Qloo insights call per match refresh,
// restricted to the candidates' brands. Only the match-refresh job calls
// this; the request path never calls Qloo.

import type { QlooInsightEntity, QlooResult } from './qloo';

export interface MatchQloo {
   insights(args: {
      filterType: 'brand';
      signals: readonly string[];
      candidates: readonly string[];
   }): Promise<QlooResult<QlooInsightEntity[]>>;
}

export type AffinityResult =
   | { ok: true; affinity: Map<string, number>; cached: boolean }
   | { ok: false; reason: string };

/** entity id -> query.affinity for the returned candidates. Never throws. */
export async function fetchAffinities(
   qloo: MatchQloo,
   signals: string[],
   entityIds: string[],
): Promise<AffinityResult> {
   if (signals.length === 0 || entityIds.length === 0) {
      return { ok: false, reason: 'no_entities' };
   }
   try {
      const r = await qloo.insights({ filterType: 'brand', signals, candidates: entityIds });
      if (!r.ok) return { ok: false, reason: r.reason };
      const affinity = new Map<string, number>();
      for (const e of r.data) {
         if (typeof e.affinity === 'number' && Number.isFinite(e.affinity)) {
            affinity.set(e.entity_id, e.affinity);
         }
      }
      return { ok: true, affinity, cached: r.cached };
   } catch (err) {
      return { ok: false, reason: (err as Error)?.name ?? 'error' };
   }
}

export async function defaultMatchQloo(): Promise<MatchQloo> {
   const { qlooClient } = await import('./qloo');
   return qlooClient;
}
