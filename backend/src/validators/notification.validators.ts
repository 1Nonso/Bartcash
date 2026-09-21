import { z } from 'zod';

export const listNotificationsQuerySchema =
   z.object({
      cursor: z.string().optional(),
      limit: z.coerce
         .number()
         .int()
         .min(1)
         .max(50)
         .optional(),
   });
