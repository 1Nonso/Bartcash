import { z } from 'zod';

export const createCommentSchema =
   z.object({
      body: z
         .string()
         .trim()
         .min(
            1,
            'Comment body is required.',
         )
         .max(
            1000,
            'Comment may not exceed 1000 characters.',
         ),
   });

export const listCommentsQuerySchema =
   z.object({
      cursor: z.string().optional(),
      limit: z.coerce
         .number()
         .int()
         .min(1)
         .max(50)
         .optional(),
   });
