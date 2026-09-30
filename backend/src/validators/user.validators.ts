import { z } from 'zod';

export const updateProfileSchema = z
   .object({
      first_name: z
         .string()
         .max(100)
         .optional(),
      last_name: z
         .string()
         .max(100)
         .optional(),
      bio: z
         .string()
         .max(200)
         .nullable()
         .optional(),
      location: z
         .string()
         .max(100)
         .nullable()
         .optional(),
   })
   .refine(
      (data) =>
         Object.values(data).some(
            (v) => v !== undefined,
         ),
      {
         message:
            'At least one field must be provided.',
         path: ['general'],
      },
   );

export const deleteAccountSchema =
   z.object({
      confirmation: z.literal(
         'DELETE',
         {
            error: () => ({
               message:
                  'Confirmation must equal the string DELETE.',
            }),
         },
      ),
   });

export const pushTokenSchema = z.object(
   {
      push_token: z.string().min(1),
   },
);
