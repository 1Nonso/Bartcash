import { z } from 'zod';

export const sendMessageSchema =
   z.object({
      body: z
         .string()
         .trim()
         .min(
            1,
            'Message body is required.',
         )
         .max(
            2000,
            'Message body may not exceed 2000 characters.',
         ),
   });

export const listMessagesQuerySchema =
   z.object({
      cursor: z.string().optional(),
      limit: z.coerce
         .number()
         .int()
         .min(1)
         .max(50)
         .optional(),
   });
