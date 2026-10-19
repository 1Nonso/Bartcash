import { db } from '../config/db.config';

// ============================================================================
// Want-suggestion fallback order (Phase 3 v3.0, Section 10.6). No Qloo or
// Groq calls:
//   1. categories most often picked as wants on published items in the
//      item's own category;
//   2. then categories with the most available items;
//   3. then the remaining active categories by name.
// ============================================================================

export const SUGGESTION_COUNT = 5;

export interface WantSuggestion {
   category_id: string;
   rank: number;
   /** 140 characters at most; null for fallback (API §16.5). */
   reason: string | null;
}

interface Cat {
   id: string;
   name: string;
}

/** Pure ordering, so it can be tested without a database. */
export function orderFallback(
   categories: readonly Cat[],
   wantCounts: ReadonlyMap<string, number>,
   availableCounts: ReadonlyMap<string, number>,
): string[] {
   const byName = [...categories].sort((a, b) => a.name.localeCompare(b.name));
   const tier = (counts: ReadonlyMap<string, number>) =>
      byName
         .filter((c) => (counts.get(c.id) ?? 0) > 0)
         .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0));

   const out: string[] = [];
   for (const c of [...tier(wantCounts), ...tier(availableCounts), ...byName]) {
      if (!out.includes(c.id)) out.push(c.id);
   }
   return out;
}

/** Active category ids in fallback order for an item in `categoryId`. */
export async function getFallbackOrder(categoryId: string): Promise<string[]> {
   const [categories, wants, available] = await Promise.all([
      db.category.findMany({
         where: { isActive: true },
         select: { id: true, name: true },
      }),
      db.itemWant.groupBy({
         by: ['categoryId'],
         where: {
            item: {
               categoryId,
               deletedAt: null,
               status: { not: 'draft' },
            },
         },
         _count: { _all: true },
      }),
      db.item.groupBy({
         by: ['categoryId'],
         where: { status: 'available', deletedAt: null },
         _count: { _all: true },
      }),
   ]);

   return orderFallback(
      categories,
      new Map(wants.map((w) => [w.categoryId, w._count._all])),
      new Map(available.map((a) => [a.categoryId, a._count._all])),
   );
}

/**
 * Pad `picked` to exactly five from `fallbackOrder`, no duplicates, ranks
 * 1 to 5. Fallback rows get reason null.
 */
export function fillToFive(
   picked: readonly { category_id: string; reason: string | null }[],
   fallbackOrder: readonly string[],
): WantSuggestion[] {
   const out: WantSuggestion[] = [];
   const seen = new Set<string>();
   const add = (category_id: string, reason: string | null) => {
      if (out.length >= SUGGESTION_COUNT || seen.has(category_id)) return;
      seen.add(category_id);
      out.push({ category_id, rank: out.length + 1, reason });
   };
   for (const p of picked) add(p.category_id, p.reason);
   for (const id of fallbackOrder) add(id, null);
   return out;
}
