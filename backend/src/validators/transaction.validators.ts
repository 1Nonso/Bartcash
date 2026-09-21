import { z } from 'zod';

export const listTransactionsQuerySchema =
   z.object({
      type: z
         .enum(['cash', 'item'])
         .optional(),
      status: z
         .enum([
            'pending_completion',
            'completed',
         ])
         .optional(),
      cursor: z.string().optional(),
      limit: z.coerce
         .number()
         .int()
         .min(1)
         .max(50)
         .optional(),
   });
