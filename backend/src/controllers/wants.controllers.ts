import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import z from 'zod';
import { db } from '../config/db.config';
import { getWantSuggestions } from '../services/wantSuggestions.service';

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
