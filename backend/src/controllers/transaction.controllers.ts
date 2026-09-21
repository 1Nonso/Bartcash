import type {
   Request,
   Response,
} from 'express';
import { db } from '../config/db.config';
import {
   ReasonPhrases,
   StatusCodes,
} from 'http-status-codes';
import { listTransactionsQuerySchema } from '../validators/transaction.validators';
import {
   encodeCursor,
   decodeCursor,
} from '../utils/cursor';

// Spec §13: other_party = { id, first_name, last_name, profile_photo }
function formatParty(user: any) {
   return {
      id: user.id,
      first_name: user.firstName,
      last_name: user.lastName,
      profile_photo: user.profilePhoto,
   };
}

// "Full profile" for the detail view — public fields only (no email).
function formatProfile(user: any) {
   return {
      id: user.id,
      first_name: user.firstName,
      last_name: user.lastName,
      profile_photo: user.profilePhoto,
      bio: user.bio,
      location: user.location,
      average_rating:
         user.averageRating,
      total_trades: user.totalTrades,
   };
}

function formatThumb(item: any) {
   return {
      id: item.id,
      title: item.title,
      primary_image:
         item.images?.[0]?.url ?? null,
   };
}

function formatValuation(
   valuation: any,
) {
   if (!valuation) return null;
   return {
      id: valuation.id,
      value_min: valuation.valueMin,
      value_max: valuation.valueMax,
      currency: valuation.currency,
      confidence: valuation.confidence,
      status: valuation.status,
      failed_reason:
         valuation.failedReason,
   };
}

function formatFullItem(
   item: any,
   { withValuation = false } = {},
) {
   return {
      id: item.id,
      title: item.title,
      description: item.description,
      condition: item.condition,
      desired_trade: item.desiredTrade,
      is_service: item.isService,
      status: item.status,
      location: item.location,
      images: item.images.map(
         (img: any) => ({
            id: img.id,
            url: img.url,
            is_primary: img.isPrimary,
            display_order:
               img.displayOrder,
         }),
      ),
      ...(withValuation
         ? {
              valuation:
                 formatValuation(
                    item.valuation,
                 ),
           }
         : {}),
   };
}

// Batch-resolve thumbnails (primary image only) in one query.
async function resolveThumbs(
   ids: string[],
) {
   if (ids.length === 0)
      return new Map<string, any>();
   const items = await db.item.findMany(
      {
         where: { id: { in: ids } },
         include: {
            images: {
               where: {
                  isPrimary: true,
               },
               take: 1,
            },
         },
      },
   );
   return new Map(
      items.map((i) => [i.id, i]),
   );
}

// Full items with all images, in the order the ids were given.
async function resolveFullItems(
   ids: string[],
) {
   if (ids.length === 0) return [];
   const items = await db.item.findMany(
      {
         where: { id: { in: ids } },
         include: {
            images: {
               orderBy: {
                  displayOrder: 'asc',
               },
            },
         },
      },
   );
   const byId = new Map(
      items.map((i) => [i.id, i]),
   );
   return ids
      .map((id) => byId.get(id))
      .filter(
         (
            i,
         ): i is NonNullable<
            typeof i
         > => i !== undefined,
      );
}

// -------------------------------------------------------------------------
// GET /transactions
// -------------------------------------------------------------------------
export async function index(
   req: Request,
   res: Response,
) {
   const parsed =
      listTransactionsQuerySchema.safeParse(
         req.query,
      );
   if (!parsed.success) {
      return res
         .status(
            StatusCodes.BAD_REQUEST,
         )
         .json({
            success: false,
            message:
               ReasonPhrases.BAD_REQUEST,
            errors:
               parsed.error.flatten()
                  .fieldErrors,
         });
   }

   const userId = req.userId as string;
   const {
      type,
      status,
      cursor,
      limit = 20,
   } = parsed.data;

   // agreedAt is nullable in the schema but always set by accept();
   // the filter keeps the (agreedAt, id) cursor well-defined.
   const where: any = {
      OR: [
         { proposerId: userId },
         { receiverId: userId },
      ],
      agreedAt: { not: null },
   };
   if (type) where.tradeType = type;
   if (status) where.status = status;
   if (cursor) {
      const c = decodeCursor(cursor);
      if (!c) {
         return res
            .status(
               StatusCodes.BAD_REQUEST,
            )
            .json({
               success: false,
               message:
                  ReasonPhrases.BAD_REQUEST,
               errors: {
                  cursor: [
                     'Invalid cursor.',
                  ],
               },
            });
      }
      // AND, so it doesn't clobber the participant OR above.
      where.AND = [
         {
            OR: [
               {
                  agreedAt: {
                     lt: c.date,
                  },
               },
               {
                  agreedAt: c.date,
                  id: { lt: c.id },
               },
            ],
         },
      ];
   }

   const rows =
      await db.transaction.findMany({
         where,
         include: {
            proposer: true,
            receiver: true,
            receiverItem: {
               include: {
                  images: {
                     where: {
                        isPrimary: true,
                     },
                     take: 1,
                  },
               },
            },
         },
         orderBy: [
            { agreedAt: 'desc' },
            { id: 'desc' },
         ],
         take: limit + 1,
      });

   const hasMore = rows.length > limit;
   const page = rows.slice(0, limit);
   const last = page.at(-1);
   const nextCursor =
      hasMore && last?.agreedAt
         ? encodeCursor(
              last.agreedAt,
              last.id,
           )
         : null;

   const offeredIdsOf = (t: {
      offeredItemIds: unknown;
   }) =>
      (t.offeredItemIds as string[]) ??
      [];
   const thumbs = await resolveThumbs([
      ...new Set(
         page.flatMap(offeredIdsOf),
      ),
   ]);

   const transactions = page.map(
      (t) => {
         const otherParty =
            t.proposerId === userId
               ? t.receiver
               : t.proposer;
         return {
            id: t.id,
            trade_id: t.tradeId,
            trade_type: t.tradeType,
            other_party:
               formatParty(otherParty),
            receiver_item:
               t.receiverItem
                  ? formatThumb(
                       t.receiverItem,
                    )
                  : null,
            offered_items: offeredIdsOf(
               t,
            )
               .map((id) =>
                  thumbs.get(id),
               )
               .filter(Boolean)
               .map(formatThumb),
            agreed_cash_amount:
               t.agreedCashAmount,
            agreed_top_up_amount:
               t.agreedTopUpAmount,
            status: t.status,
            agreed_at: t.agreedAt,
            completed_at: t.completedAt,
         };
      },
   );

   return res
      .status(StatusCodes.OK)
      .json({
         success: true,
         message:
            'Transactions retrieved.',
         data: {
            transactions,
            next_cursor: nextCursor,
         },
      });
}

// -------------------------------------------------------------------------
// GET /transactions/:id
// -------------------------------------------------------------------------
export async function show(
   req: Request,
   res: Response,
) {
   const id = req.params.id as string;
   const t =
      await db.transaction.findUnique({
         where: { id },
         include: {
            proposer: true,
            receiver: true,
            trade: true,
            receiverItem: {
               include: {
                  images: {
                     orderBy: {
                        displayOrder:
                           'asc',
                     },
                  },
                  valuation: true,
               },
            },
         },
      });
   if (!t) {
      return res
         .status(StatusCodes.NOT_FOUND)
         .json({
            success: false,
            message:
               'Transaction not found.',
         });
   }

   const userId = req.userId as string;
   if (
      t.proposerId !== userId &&
      t.receiverId !== userId
   ) {
      return res
         .status(StatusCodes.FORBIDDEN)
         .json({
            success: false,
            message:
               'You are not a party to this transaction.',
         });
   }

   const offeredItems =
      await resolveFullItems(
         (t.offeredItemIds as string[]) ??
            [],
      );

   return res
      .status(StatusCodes.OK)
      .json({
         success: true,
         message:
            'Transaction retrieved.',
         data: {
            transaction: {
               id: t.id,
               trade_id: t.tradeId,
               trade_type: t.tradeType,
               proposer: formatProfile(
                  t.proposer,
               ),
               receiver: formatProfile(
                  t.receiver,
               ),
               receiver_item:
                  t.receiverItem
                     ? formatFullItem(
                          t.receiverItem,
                          {
                             withValuation: true,
                          },
                       )
                     : null,
               offered_items:
                  offeredItems.map(
                     (i) =>
                        formatFullItem(
                           i,
                        ),
                  ),
               agreed_cash_amount:
                  t.agreedCashAmount,
               agreed_top_up_amount:
                  t.agreedTopUpAmount,
               status: t.status,
               agreed_at: t.agreedAt,
               completed_at:
                  t.completedAt,
               trade: {
                  id: t.trade.id,
                  status:
                     t.trade.status,
                  completion_method:
                     t.trade
                        .completionMethod,
                  meetup_details:
                     t.trade
                        .meetupDetails,
                  delivery_details:
                     t.trade
                        .deliveryDetails,
                  proposer_confirmed:
                     t.trade
                        .proposerConfirmed,
                  receiver_confirmed:
                     t.trade
                        .receiverConfirmed,
               },
            },
         },
      });
}
