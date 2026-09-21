import { z } from 'zod';

export const createDisputeSchema =
   z.object({
      trade_id: z.string().uuid(),
      reason: z
         .string()
         .trim()
         .min(
            50,
            'Reason must be at least 50 characters.',
         )
         .max(
            2000,
            'Reason may not exceed 2000 characters.',
         ),
   });
