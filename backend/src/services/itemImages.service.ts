// Remove a listing photo and set the cover (Edit Listing). Adding photos is
// POST /items/:id/images (item.controllers.ts uploadImages). The valuation
// reads the cover photo, so a cover change re-runs it.

import { db } from '../config/db.config';
import { Prisma } from '../generated/prisma/client';
import { enqueueItemValuation } from '../queue/itemValuation.queue';
import { deleteFromR2, keyFromPublicUrl } from './r2.service';

/** Statuses whose photos may change (not in a trade, not traded). */
const EDITABLE = new Set(['draft', 'available']);

export type ImageEditResult =
   | { ok: true; images: { id: string; url: string; is_primary: boolean; display_order: number }[]; valuation_status: 'pending' | null }
   | { ok: false; status: 403 | 404 | 422; code?: string; message: string };

async function loadOwned(itemId: string, imageId: string, userId: string) {
   const item = await db.item.findFirst({
      where: { id: itemId, deletedAt: null },
      select: { id: true, userId: true, status: true },
   });
   if (!item) return { error: { ok: false, status: 404, message: 'Item not found.' } as const };
   if (item.userId !== userId) {
      return {
         error: { ok: false, status: 403, message: 'You do not have permission to edit this item.' } as const,
      };
   }
   if (!EDITABLE.has(item.status)) {
      return {
         error: {
            ok: false,
            status: 422,
            code: 'ITEM_NOT_EDITABLE',
            message: 'Photos can only be changed on a draft or available listing.',
         } as const,
      };
   }
   const images = await db.itemImage.findMany({
      where: { itemId },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
   });
   const image = images.find((i) => i.id === imageId);
   if (!image) return { error: { ok: false, status: 404, message: 'Photo not found.' } as const };
   return { item, images, image };
}

/** Same reset as a photo upload: one valuation row per item, back to pending. */
async function requeueValuation(itemId: string) {
   const valuation = await db.itemValuation.upsert({
      where: { itemId },
      update: {
         status: 'pending',
         failedReason: null,
         valueMin: null,
         valueMax: null,
         confidence: null,
         rawResponse: Prisma.DbNull,
      },
      create: { itemId, status: 'pending', currency: 'USD' },
   });
   await enqueueItemValuation({ itemId, valuationId: valuation.id });
}

function format(images: { id: string; url: string; isPrimary: boolean; displayOrder: number }[]) {
   return images.map((i) => ({
      id: i.id,
      url: i.url,
      is_primary: i.isPrimary,
      display_order: i.displayOrder,
   }));
}

async function current(itemId: string) {
   return db.itemImage.findMany({
      where: { itemId },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
   });
}

/** DELETE /items/:id/images/:imageId. Never the last photo. */
export async function removeImage(itemId: string, imageId: string, userId: string): Promise<ImageEditResult> {
   const r = await loadOwned(itemId, imageId, userId);
   if ('error' in r) return r.error;
   if (r.images.length <= 1) {
      return {
         ok: false,
         status: 422,
         code: 'LAST_IMAGE',
         message: 'A listing needs at least one photo. Add another before removing this one.',
      };
   }

   const rest = r.images.filter((i) => i.id !== imageId);
   const newCover = r.image.isPrimary ? rest[0]! : null;
   await db.$transaction(async (tx) => {
      await tx.itemImage.delete({ where: { id: imageId } });
      // Close the gap in display order; promote the next photo if the cover went.
      for (const [i, img] of rest.entries()) {
         await tx.itemImage.update({
            where: { id: img.id },
            data: { displayOrder: i, ...(newCover && img.id === newCover.id ? { isPrimary: true } : {}) },
         });
      }
   });
   // Best effort: a stray object in storage is harmless.
   deleteFromR2(keyFromPublicUrl(r.image.url)).catch((err) =>
      console.error(`item-images: storage delete failed for item ${itemId}:`, (err as Error).name),
   );
   if (newCover) await requeueValuation(itemId);
   return { ok: true, images: format(await current(itemId)), valuation_status: newCover ? 'pending' : null };
}

/** PATCH /items/:id/images/:imageId/primary. Re-runs the valuation. */
export async function setCover(itemId: string, imageId: string, userId: string): Promise<ImageEditResult> {
   const r = await loadOwned(itemId, imageId, userId);
   if ('error' in r) return r.error;
   if (r.image.isPrimary) return { ok: true, images: format(r.images), valuation_status: null };

   await db.$transaction([
      db.itemImage.updateMany({ where: { itemId, isPrimary: true }, data: { isPrimary: false } }),
      db.itemImage.update({ where: { id: imageId }, data: { isPrimary: true } }),
   ]);
   await requeueValuation(itemId);
   return { ok: true, images: format(await current(itemId)), valuation_status: 'pending' };
}
