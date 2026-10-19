import type { Request, Response } from 'express';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import z from 'zod';
import { db } from '../config/db.config';
import {
   decodeRankCursor,
   DEFAULT_LIMIT,
   getMatches,
   MAX_LIMIT,
} from '../services/matches.service';

// ============================================================================
// Matches endpoint (Phase 4b, Section 16.6). Mounted behind requireQloo, so
// the flag is already on here.
// ============================================================================

const uuid = z.uuid();

/** GET /items/{id}/matches (owner only). */
export async function itemMatches(req: Request, res: Response) {
   const id = req.params.id as string;

   const rawLimit = req.query.limit;
   const limit = rawLimit === undefined ? DEFAULT_LIMIT : Number(rawLimit);
   const cursor = req.query.cursor as string | undefined;
   const afterRank = cursor === undefined ? 0 : decodeRankCursor(cursor);
   if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT || afterRank === null) {
      return res.status(StatusCodes.BAD_REQUEST).json({
         success: false,
         message: ReasonPhrases.BAD_REQUEST,
         errors: {
            ...(afterRank === null ? { cursor: ['Invalid cursor.'] } : {}),
            ...(!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT
               ? { limit: [`limit must be an integer from 1 to ${MAX_LIMIT}.`] }
               : {}),
         },
      });
   }

   const item = uuid.safeParse(id).success
      ? await db.item.findFirst({
           where: { id, deletedAt: null },
           select: {
              id: true,
              userId: true,
              categoryId: true,
              status: true,
              desiredTrade: true,
           },
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
         message: 'You do not have permission to view matches for this item.',
      });
   }
   if (item.status !== 'available') {
      return res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
         success: false,
         code: 'ITEM_UNAVAILABLE',
         message: 'This item is not available.',
      });
   }

   const data = await getMatches(item, { limit, afterRank });
   return res.status(StatusCodes.OK).json({
      success: true,
      message: 'Matches retrieved.',
      data,
   });
}
