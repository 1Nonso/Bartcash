import { z } from 'zod';

export const createTradeSchema = z
   .object({
      receiver_id: z.string().uuid(),
      receiver_item_id: z
         .string()
         .uuid(),
      trade_type: z.enum([
         'cash',
         'item',
      ]),
      cash_amount: z.coerce
         .number()
         .positive()
         .optional(),
      offered_item_ids: z
         .array(z.string().uuid())
         .min(1)
         .optional(),
      top_up_amount: z.coerce
         .number()
         .min(0)
         .optional(),
      message: z
         .string()
         .max(500)
         .optional(),
   })
   .superRefine((data, ctx) => {
      if (
         data.trade_type === 'cash' &&
         data.cash_amount === undefined
      ) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['cash_amount'],
            message:
               'cash_amount is required for cash trades.',
         });
      }
      if (
         data.trade_type === 'item' &&
         (!data.offered_item_ids ||
            data.offered_item_ids
               .length === 0)
      ) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['offered_item_ids'],
            message:
               'offered_item_ids is required for item trades.',
         });
      }
   });

export const rebargainSchema = z
   .object({
      cash_amount: z.coerce
         .number()
         .positive()
         .optional(),
      offered_item_ids: z
         .array(z.string().uuid())
         .min(1)
         .optional(),
      top_up_amount: z.coerce
         .number()
         .min(0)
         .optional(),
      message: z
         .string()
         .max(500)
         .optional(),
   })
   .refine(
      (d) =>
         d.cash_amount !== undefined ||
         d.offered_item_ids !==
            undefined ||
         d.top_up_amount !== undefined,
      {
         message:
            'At least one term must be changed.',
      },
   );

export const acceptTradeSchema = z
   .object({
      completion_method: z.enum([
         'meetup',
         'delivery',
      ]),
      meetup_details: z
         .string()
         .min(1)
         .max(500)
         .optional(),
      delivery_details: z
         .string()
         .min(1)
         .max(500)
         .optional(),
   })
   .superRefine((data, ctx) => {
      if (
         data.completion_method ===
            'meetup' &&
         !data.meetup_details
      ) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['meetup_details'],
            message:
               'meetup_details is required when completion_method is meetup.',
         });
      }
      if (
         data.completion_method ===
            'delivery' &&
         !data.delivery_details
      ) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['delivery_details'],
            message:
               'delivery_details is required when completion_method is delivery.',
         });
      }
   });

export const listTradesQuerySchema =
   z.object({
      status: z
         .enum([
            'negotiating',
            'accepted',
            'completed',
            'disputed',
            'cancelled',
            'declined',
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
