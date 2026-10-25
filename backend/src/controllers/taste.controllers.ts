import type { Request, Response } from 'express';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import z from 'zod';
import {
   defaultTasteQloo,
   refreshMatchesNow,
   getProfile,
   getSuggestions,
   profileBodySchema,
   replaceProfile,
   searchQuerySchema,
   searchTaste,
   suggestionsQuerySchema,
} from '../services/tasteProfile.service';
import {
   compatibleUsersQuerySchema,
   getCompatibleUsers,
   getPairCompatibility,
   queueTasteCompat,
} from '../services/tasteCompat.service';

// ============================================================================
// Taste endpoints (Phase 4b, Section 16.4). Mounted behind requireQloo, so
// the flag is already on here.
// ============================================================================

/** GET /taste/search?q=&type=&limit= */
export async function search(req: Request, res: Response) {
   const parsed = searchQuerySchema.safeParse(req.query);
   if (!parsed.success) {
      return res.status(StatusCodes.BAD_REQUEST).json({
         success: false,
         message: ReasonPhrases.BAD_REQUEST,
         errors: z.flattenError(parsed.error).fieldErrors,
      });
   }

   const result = await searchTaste(await defaultTasteQloo(), req.userId as string, parsed.data);
   if (!result.ok) {
      // Logged by reason code only (no query text or user id).
      console.warn(`taste-search: unavailable (${result.reason})`);
      return res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
         success: false,
         code: 'TASTE_SEARCH_UNAVAILABLE',
         message: 'Interest search is unavailable right now. Please try again later.',
      });
   }
   return res.status(StatusCodes.OK).json({
      success: true,
      message: 'Entities retrieved.',
      data: { entities: result.entities },
   });
}

/** GET /taste/suggestions?type= — shown on Add Interests before a search. */
export async function suggestions(req: Request, res: Response) {
   const parsed = suggestionsQuerySchema.safeParse(req.query);
   if (!parsed.success) {
      return res.status(StatusCodes.BAD_REQUEST).json({
         success: false,
         message: ReasonPhrases.BAD_REQUEST,
         errors: z.flattenError(parsed.error).fieldErrors,
      });
   }
   const sections = await getSuggestions(
      await defaultTasteQloo(),
      req.userId as string,
      parsed.data.type,
   );
   return res.status(StatusCodes.OK).json({
      success: true,
      message: 'Suggestions retrieved.',
      data: { sections },
   });
}

/** GET /taste/profile */
export async function profile(req: Request, res: Response) {
   const data = await getProfile(req.userId as string);
   return res.status(StatusCodes.OK).json({
      success: true,
      message: 'Profile retrieved.',
      data,
   });
}

/** PUT /taste/profile — replace the whole profile (empty list clears it). */
export async function replace(req: Request, res: Response) {
   const parsed = profileBodySchema.safeParse(req.body ?? {});
   if (!parsed.success) {
      return res.status(StatusCodes.BAD_REQUEST).json({
         success: false,
         message: ReasonPhrases.BAD_REQUEST,
         errors: z.flattenError(parsed.error).fieldErrors,
      });
   }
   const userId = req.userId as string;
   const data = await replaceProfile(userId, parsed.data.entities);
   // The job recomputes pairs, then refreshes this user's matches.
   const queued = await queueTasteCompat(userId, 'profile');
   if (!queued) await refreshMatchesNow(userId);
   return res.status(StatusCodes.OK).json({
      success: true,
      message: 'Taste profile saved.',
      data: { ...data, compat_status: queued ? 'refreshing' : null },
   });
}

/** GET /taste/compatible-users?cursor=&limit= */
export async function compatibleUsers(req: Request, res: Response) {
   const parsed = compatibleUsersQuerySchema.safeParse(req.query);
   if (!parsed.success) {
      return res.status(StatusCodes.BAD_REQUEST).json({
         success: false,
         message: ReasonPhrases.BAD_REQUEST,
         errors: z.flattenError(parsed.error).fieldErrors,
      });
   }
   const result = await getCompatibleUsers(req.userId as string, parsed.data);
   if (!result.ok) {
      return res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
         success: false,
         code: result.code,
         message: 'Add at least 3 interests to your taste profile first.',
      });
   }
   return res.status(StatusCodes.OK).json({
      success: true,
      message: 'Compatible users retrieved.',
      data: result.data,
   });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GET /users/:id/taste-compatibility */
export async function pairCompatibility(req: Request, res: Response) {
   const otherId = String(req.params.id);
   if (!UUID_RE.test(otherId)) {
      return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: 'User not found.' });
   }
   const result = await getPairCompatibility(req.userId as string, otherId);
   if (!result.ok) {
      return res.status(result.status).json({ success: false, message: result.message });
   }
   return res.status(StatusCodes.OK).json({
      success: true,
      message: 'Compatibility retrieved.',
      data: result.data,
   });
}
