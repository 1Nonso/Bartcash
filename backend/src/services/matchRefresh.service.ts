import { isQlooEnabled } from '../config/features.config';
import { enqueueMatchRefresh } from '../queue/matchRefresh.queue';

// What triggered the refresh; logged with the item id only.
export type MatchRefreshTrigger =
   | 'publish'
   | 'wants_change'
   | 'taste_done'
   | 'stale_read'
   | 'first_read';

/** Reads queue at most one refresh per item per hour (per process). */
export const READ_REFRESH_INTERVAL_MS = 60 * 60 * 1000;
const lastReadRefresh = new Map<string, number>();

/** True when a read-triggered refresh for this item is allowed now. */
export function takeReadRefreshSlot(
   itemId: string,
   now = Date.now(),
   seen: Map<string, number> = lastReadRefresh,
): boolean {
   const last = seen.get(itemId);
   if (last !== undefined && now - last < READ_REFRESH_INTERVAL_MS) return false;
   seen.set(itemId, now);
   return true;
}

// Best-effort enqueue. Never throws, so it can never fail a request.
// Publish and wants changes always queue (duplicates collapse on the
// singleton key); stale and first reads are capped at one per hour.
export async function queueMatchRefresh(
   itemId: string,
   trigger: MatchRefreshTrigger,
): Promise<void> {
   if (!isQlooEnabled()) return;
   if (
      (trigger === 'stale_read' || trigger === 'first_read') &&
      !takeReadRefreshSlot(itemId)
   ) {
      return;
   }
   try {
      const jobId = await enqueueMatchRefresh({ itemId });
      console.log(
         `match-refresh: item ${itemId} ${jobId ? 'queued' : 'already queued'} (${trigger})`,
      );
   } catch (err) {
      console.error(
         `match-refresh: enqueue failed for item ${itemId}:`,
         (err as Error).message,
      );
   }
}
