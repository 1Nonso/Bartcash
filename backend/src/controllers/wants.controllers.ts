import type { Request, Response } from 'express';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import z from 'zod';
import { db } from '../config/db.config';
import { getWantSuggestions } from '../services/wantSuggestions.service';
import { setWants, wantsBodySchema } from '../services/wants.service';
import { queueMatchRefresh } from '../services/matchRefresh.service';

// ============================================================================
// Wants endpoints (Phase 4b, Section 16.5). Mounted behind requireQloo, so
// the flag is already on here.
// ============================================================================

const uuid = z.uuid();

/** GET /items/{id}/want-suggestions (owner only). */
export async function wantSuggestions(req: Request, res: Response) {
   const id = req.params.id as string;
   const item = uuid.safeParse(id).success
      ? await db.item.findFirst({
           where: { id, deletedAt: null },
           select: { id: true, userId: true, categoryId: true },
        })
      : null;

   if (!item) {
      return res.status(StatusCodes.NOT_FOUND).json({
         success: false,
         message: 'Item not found.',
      });
   }
   if (item.userId !== req.userId) {
      return res.status(StatusCodes.FORBIDDEN).json({
         success: false,
         message: 'You do not have permission to view suggestions for this item.',
      });
   }

   const data = await getWantSuggestions(item);
   return res.status(StatusCodes.OK).json({
      success: true,
      message: 'Want suggestions retrieved.',
      data,
   });
}

/** PUT /items/{id}/wants (owner only): replace the 1 to 3 ranked wants. */
export async function setItemWants(req: Request, res: Response) {
   const parsed = wantsBodySchema.safeParse(req.body ?? {});
   if (!parsed.success) {
      return res.status(StatusCodes.BAD_REQUEST).json({
         success: false,
         message: ReasonPhrases.BAD_REQUEST,
         errors: z.flattenError(parsed.error).fieldErrors,
      });
   }

   const id = req.params.id as string;
   const item = uuid.safeParse(id).success
      ? await db.item.findFirst({
           where: { id, deletedAt: null },
           select: { id: true, userId: true, categoryId: true, status: true },
        })
      : null;

   if (!item) {
      return res.status(StatusCodes.NOT_FOUND).json({
         success: false,
         message: 'Item not found.',
      });
   }
   if (item.userId !== req.userId) {
      return res.status(StatusCodes.FORBIDDEN).json({
         success: false,
         message: 'You do not have permission to edit this item.',
      });
   }
   if (['in_trade', 'traded'].includes(item.status)) {
      return res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
         success: false,
         message: 'This item cannot be edited while in an active trade.',
      });
   }

   const result = await setWants(item, parsed.data);
   if (!result.ok) {
      return res.status(StatusCodes.NOT_FOUND).json({
         success: false,
         message: 'The selected category is invalid or inactive.',
      });
   }
   if (item.status === 'available') await queueMatchRefresh(item.id, 'wants_change');
   return res.status(StatusCodes.OK).json({
      success: true,
      message: 'Wants saved.',
      data: result.data,
   });
}
