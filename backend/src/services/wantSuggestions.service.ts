import { db } from '../config/db.config';
import { requestItemTaste } from './itemTaste.service';
import {
   fillToFive,
   getFallbackOrder,
   type WantSuggestion,
} from './wantFallback.service';

// ============================================================================
// GET /items/{id}/want-suggestions (Phase 4b, Sections 16.5 and 16.10).
// Decisions agreed Oct 17:
//   - The 20-second pending window runs from when the item_tastes row became
//     pending (updated_at), not from item creation, so an edit re-run also
//     waits before falling back.
//   - Stored suggestions whose category is no longer active are dropped and
//     refilled from the fallback order, so ready always has exactly five.
// buildSuggestions() decides the response with no database access.
// ============================================================================

export const MAX_PICKS = 3;
export const PENDING_WINDOW_MS = 20_000;
export const RETRY_AFTER_MS = 2_000;

export interface CategoryRef {
   id: string;
   name: string;
   slug: string;
   icon: string | null;
}

export interface TasteRow {
   status: string;
   wantSuggestions: unknown;
   suggestionSource: string | null;
   updatedAt: Date;
}

export interface SuggestionsData {
   status: 'pending' | 'ready' | 'fallback';
   source: 'qloo' | 'fallback' | null;
   suggestions: { category: CategoryRef; rank: number; reason: string | null }[];
   picked_category_ids: string[];
   max_picks: number;
   retry_after_ms: number | null;
}

/** Stored JSON -> suggestions, ignoring malformed entries. */
function parseStored(v: unknown): { category_id: string; reason: string | null }[] {
   if (!Array.isArray(v)) return [];
   return v
      .filter(
         (s): s is { category_id: string; rank?: unknown; reason?: unknown } =>
            typeof s === 'object' && s !== null && typeof s.category_id === 'string',
      )
      .sort((a, b) => Number(a.rank ?? 0) - Number(b.rank ?? 0))
      .map((s) => ({
         category_id: s.category_id,
         reason: typeof s.reason === 'string' ? s.reason : null,
      }));
}

/**
 * Pure: the response for a row (null = no row yet), given the active
 * categories, the fallback order, current picks and the time.
 */
export function buildSuggestions(
   row: TasteRow | null,
   ctx: {
      categories: readonly CategoryRef[];
      fallbackOrder: readonly string[];
      pickedCategoryIds: readonly string[];
      nowMs: number;
   },
): SuggestionsData {
   const base = {
      picked_category_ids: [...ctx.pickedCategoryIds],
      max_picks: MAX_PICKS,
   };
   const pending: SuggestionsData = {
      status: 'pending',
      source: null,
      suggestions: [],
      ...base,
      retry_after_ms: RETRY_AFTER_MS,
   };
   if (!row) return pending;
   if (
      row.status === 'pending' &&
      ctx.nowMs - row.updatedAt.getTime() < PENDING_WINDOW_MS
   ) {
      return pending;
   }

   const byId = new Map(ctx.categories.map((c) => [c.id, c]));
   const toRefs = (list: WantSuggestion[]) =>
      list.flatMap((s) => {
         const category = byId.get(s.category_id);
         return category ? [{ category, rank: s.rank, reason: s.reason }] : [];
      });
   // Fallback order only holds active ids, so fillToFive stays within byId.
   const active = ctx.fallbackOrder.filter((id) => byId.has(id));

   if (row.status === 'resolved') {
      const stored = parseStored(row.wantSuggestions).filter((s) =>
         byId.has(s.category_id),
      );
      return {
         status: 'ready',
         source: row.suggestionSource === 'qloo' ? 'qloo' : 'fallback',
         suggestions: toRefs(fillToFive(stored, active)),
         ...base,
         retry_after_ms: null,
      };
   }

   // Pending too long, unresolved or failed: fresh fallback, not stored.
   return {
      status: 'fallback',
      source: 'fallback',
      suggestions: toRefs(fillToFive([], active)),
      ...base,
      retry_after_ms: null,
   };
}

/** Everything buildSuggestions needs, loaded in parallel. */
async function loadInputs(item: { id: string; categoryId: string }) {
   const [row, categories, fallbackOrder, wants] = await Promise.all([
      db.itemTaste.findUnique({
         where: { itemId: item.id },
         select: {
            status: true,
            wantSuggestions: true,
            suggestionSource: true,
            updatedAt: true,
         },
      }),
      db.category.findMany({
         where: { isActive: true },
         select: { id: true, name: true, slug: true, icon: true },
      }),
      getFallbackOrder(item.categoryId),
      db.itemWant.findMany({
         where: { itemId: item.id },
         orderBy: { rank: 'asc' },
         select: { categoryId: true },
      }),
   ]);
   return {
      row,
      ctx: {
         categories,
         fallbackOrder,
         pickedCategoryIds: wants.map((w) => w.categoryId),
         nowMs: Date.now(),
      },
   };
}

/** Loads and builds. Creates the pending row and queues the job if absent. */
export async function getWantSuggestions(item: {
   id: string;
   categoryId: string;
}): Promise<SuggestionsData> {
   const { row, ctx } = await loadInputs(item);
   // Older item with no row: start the job and report pending.
   if (!row) await requestItemTaste(item.id);
   return buildSuggestions(row, ctx);
}

/**
 * Category ids of the five suggestions the owner would see right now
 * (empty while pending). Read-only: never creates a row or queues a job.
 */
export async function getShownSuggestionIds(item: {
   id: string;
   categoryId: string;
}): Promise<string[]> {
   const { row, ctx } = await loadInputs(item);
   return buildSuggestions(row, ctx).suggestions.map((s) => s.category.id);
}
