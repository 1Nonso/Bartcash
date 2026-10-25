import type { Request, Response } from 'express';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import z from 'zod';
import { draftBodySchema, draftOffer } from '../services/scoutDraft.service';

// ============================================================================
// Scout endpoint (Phase 4b, Section 16.7). Mounted behind requireQloo, so the
// flag is already on here. Read-only: nothing is created.
// ============================================================================

/** POST /scout/draft-offer { source_item_id, target_item_id } */
export async function draftOfferHandler(req: Request, res: Response) {
   const parsed = draftBodySchema.safeParse(req.body ?? {});
   if (!parsed.success) {
      return res.status(StatusCodes.BAD_REQUEST).json({
         success: false,
         message: ReasonPhrases.BAD_REQUEST,
         errors: z.flattenError(parsed.error).fieldErrors,
      });
   }
   const result = await draftOffer(
      req.userId as string,
      parsed.data.source_item_id,
      parsed.data.target_item_id,
   );
   if (!result.ok) {
      return res.status(result.status).json({
         success: false,
         ...(result.code ? { code: result.code } : {}),
         message: result.message,
      });
   }
   return res.status(StatusCodes.OK).json({
      success: true,
      message: 'Draft prepared.',
      data: { draft: result.draft },
   });
}
