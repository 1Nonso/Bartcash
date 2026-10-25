import z from 'zod';
import { db } from '../config/db.config';
import { getShownSuggestionIds, MAX_PICKS, type CategoryRef } from './wantSuggestions.service';

// ============================================================================
// PUT /items/{id}/wants (Phase 4b, Section 16.5; Phase 3 v3.0, Section 3.20).
// One to three ranked categories plus the optional note (items.desired_trade).
// Match-refresh is not queued yet (Phase 4).
// ============================================================================

export const NOTE_MAX = 500;

export const wantsBodySchema = z.object({
   category_ids: z
      .array(z.uuid('Each category id must be a UUID.'), {
         error: 'Choose at least one category.',
      })
      .min(1, 'Choose at least one category.')
      .max(MAX_PICKS, `Choose at most ${MAX_PICKS} categories.`)
      .refine((ids) => new Set(ids).size === ids.length, 'Categories must be distinct.'),
   // undefined = leave unchanged, null = clear.
   note: z.string().trim().max(NOTE_MAX, `Note must be ${NOTE_MAX} characters or fewer.`).nullable().optional(),
});

export type WantsBody = z.infer<typeof wantsBodySchema>;

export interface WantRow {
   categoryId: string;
   rank: number;
   wasSuggested: boolean;
}

/** Pure: position is the rank; flag the ones among the shown suggestions. */
export function buildWantRows(
   categoryIds: readonly string[],
   shownSuggestionIds: readonly string[],
): WantRow[] {
   const shown = new Set(shownSuggestionIds);
   return categoryIds.map((categoryId, i) => ({
      categoryId,
      rank: i + 1,
      wasSuggested: shown.has(categoryId),
   }));
}

export interface WantsData {
   wants: { category: CategoryRef; rank: number; was_suggested: boolean }[];
   note: string | null;
   matches_status: 'refreshing' | 'not_published';
}

export type SetWantsResult =
   | { ok: true; data: WantsData }
   | { ok: false; reason: 'invalid_category' };

/** Replaces the item's wants (and note, when given) in one transaction. */
export async function setWants(
   item: { id: string; categoryId: string; status: string },
   body: WantsBody,
): Promise<SetWantsResult> {
   const categories = await db.category.findMany({
      where: { id: { in: body.category_ids }, isActive: true },
      select: { id: true, name: true, slug: true, icon: true },
   });
   if (categories.length !== body.category_ids.length) {
      return { ok: false, reason: 'invalid_category' };
   }

   const rows = buildWantRows(body.category_ids, await getShownSuggestionIds(item));

   const updated = await db.$transaction(async (tx) => {
      await tx.itemWant.deleteMany({ where: { itemId: item.id } });
      await tx.itemWant.createMany({
         data: rows.map((r) => ({ itemId: item.id, ...r })),
      });
      return body.note === undefined
         ? tx.item.findUniqueOrThrow({ where: { id: item.id }, select: { desiredTrade: true } })
         : tx.item.update({
              where: { id: item.id },
              data: { desiredTrade: body.note || null },
              select: { desiredTrade: true },
           });
   });

   const byId = new Map(categories.map((c) => [c.id, c]));
   return {
      ok: true,
      data: {
         wants: rows.map((r) => ({
            category: byId.get(r.categoryId)!,
            rank: r.rank,
            was_suggested: r.wasSuggested,
         })),
         note: updated.desiredTrade,
         matches_status: item.status === 'available' ? 'refreshing' : 'not_published',
      },
   };
}
