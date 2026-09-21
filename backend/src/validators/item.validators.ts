import { z } from 'zod';

const conditionEnum = z.enum([
   'new',
   'good',
   'fair',
   'poor',
]);

export const createItemSchema =
   z.object({
      title: z.string().max(255),
      description: z.string().min(20),
      category_id: z.string().uuid(),
      condition: conditionEnum,
      desired_trade: z
         .string()
         .max(500)
         .optional()
         .nullable(),
      is_service: z
         .boolean()
         .optional(),
      location: z
         .string()
         .max(100)
         .optional()
         .nullable(),
   });

export const updateItemSchema =
   createItemSchema.partial().extend({
      user_declared_value: z.coerce
         .number()
         .positive()
         .optional(),
   });

export const listItemsQuerySchema = z
   .object({
      search: z
         .string()
         .max(255)
         .optional(),
      category_id: z
         .string()
         .uuid()
         .optional(),
      condition:
         conditionEnum.optional(),
      value_min: z.coerce
         .number()
         .min(0)
         .optional(),
      value_max: z.coerce
         .number()
         .min(0)
         .optional(),
      is_service: z.coerce
         .boolean()
         .optional(),
      cursor: z.string().optional(),
      limit: z.coerce
         .number()
         .int()
         .min(1)
         .max(50)
         .optional(),
   })
   .refine(
      (d) =>
         d.value_max === undefined ||
         d.value_min === undefined ||
         d.value_max >= d.value_min,
      {
         message:
            'Maximum value must be greater than or equal to minimum value.',
         path: ['value_max'],
      },
   );

export const overrideValuationSchema = z
   .object({
      value_min: z.coerce
         .number()
         .min(0),
      value_max: z.coerce.number(),
   })
   .refine(
      (d) => d.value_max > d.value_min,
      {
         message:
            'value_max must be greater than value_min',
         path: ['value_max'],
      },
   );
