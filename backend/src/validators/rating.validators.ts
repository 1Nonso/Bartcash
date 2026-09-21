import { z } from 'zod';

export const submitRatingSchema =
   z.object({
      trade_id: z.string().uuid(),
      score: z
         .number()
         .int()
         .min(
            1,
            'Score must be between 1 and 5.',
         )
         .max(
            5,
            'Score must be between 1 and 5.',
         ),
      review: z
         .string()
         .trim()
         .max(
            500,
            'Review may not exceed 500 characters.',
         )
         .optional(),
   });

export const listRatingsQuerySchema =
   z.object({
      cursor: z.string().optional(),
      limit: z.coerce
         .number()
         .int()
         .min(1)
         .max(50)
         .optional(),
   });
