import type {
   Request,
   Response,
} from 'express';
import { db } from '../config/db.config';
import {
   ReasonPhrases,
   StatusCodes,
} from 'http-status-codes';
import {
   createTradeSchema,
   rebargainSchema,
   acceptTradeSchema,
   listTradesQuerySchema,
} from '../validators/trade.validators';
import { notify } from '../services/notification.service';
import {
   decodeCursor,
   encodeCursor,
} from '../utils/cursor';

const ROUND_LIMIT = 3;
const ROUND_WINDOW_MS =
   3 * 60 * 60 * 1000; // 3 hours

function formatOwner(user: any) {
   return {
      id: user.id,
      first_name: user.firstName,
      last_name: user.lastName,
      profile_photo: user.profilePhoto,
      average_rating:
         user.averageRating,
   };
}

function formatOfferedItems(
   items: any[],
) {
   return items.map((item) => ({
      id: item.id,
      title: item.title,
      primary_image:
         item.images?.[0]?.url ?? null,
   }));
}

async function resolveOfferedItems(
   ids: string[],
) {
   if (!ids || ids.length === 0)
      return [];
   return db.item.findMany({
      where: { id: { in: ids } },
      include: {
         images: {
            where: { isPrimary: true },
            take: 1,
         },
      },
   });
}

function formatCurrentOffer(
   offer: any,
   offeredItems: any[],
) {
   return {
      trade_type: offer.tradeType,
      cash_amount: offer.cashAmount,
      top_up_amount: offer.topUpAmount,
      offered_items: formatOfferedItems(
         offeredItems,
      ),
   };
}

async function expireIfRoundTimedOut<
   T extends {
      id: string;
      status: string;
      roundStartedAt: Date | null;
   },
>(trade: T): Promise<T> {
   if (
      trade.status !== 'negotiating' ||
      !trade.roundStartedAt
   )
      return trade;
   if (
      Date.now() -
         trade.roundStartedAt.getTime() <
      ROUND_WINDOW_MS
   )
      return trade;

   const itemIds = (
      await db.tradeItem.findMany({
         where: { tradeId: trade.id },
         select: { itemId: true },
      })
   ).map((ti) => ti.itemId);

   await db.$transaction([
      db.trade.update({
         where: { id: trade.id },
         data: { status: 'declined' },
      }),
      db.item.updateMany({
         where: { id: { in: itemIds } },
         data: { status: 'available' },
      }),
   ]);

   return {
      ...trade,
      status: 'declined',
   };
}

// -------------------------------------------------------------------------
// POST /trades
// -------------------------------------------------------------------------
export async function create(
   req: Request,
   res: Response,
) {
   const parsed =
      createTradeSchema.safeParse(
         req.body,
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

   const proposerId =
      req.userId as string;
   const {
      receiver_id,
      receiver_item_id,
      trade_type,
      cash_amount,
      offered_item_ids,
      top_up_amount,
      message,
   } = parsed.data;

   if (receiver_id === proposerId) {
      return res
         .status(StatusCodes.FORBIDDEN)
         .json({
            success: false,
            message:
               'You cannot propose a trade with yourself.',
         });
   }

   const receiver =
      await db.user.findFirst({
         where: {
            id: receiver_id,
            deletedAt: null,
         },
      });
   if (!receiver) {
      return res
         .status(StatusCodes.NOT_FOUND)
         .json({
            success: false,
            message:
               'Receiver not found.',
         });
   }

   const receiverItem =
      await db.item.findFirst({
         where: {
            id: receiver_item_id,
            deletedAt: null,
         },
      });
   if (
      !receiverItem ||
      receiverItem.userId !==
         receiver_id ||
      receiverItem.status !==
         'available'
   ) {
      return res
         .status(
            StatusCodes.UNPROCESSABLE_ENTITY,
         )
         .json({
            success: false,
            message:
               'The requested item is not available for trade.',
         });
   }

   let offeredItems: any[] = [];
   if (trade_type === 'item') {
      offeredItems =
         await db.item.findMany({
            where: {
               id: {
                  in: offered_item_ids as string[],
               },
               deletedAt: null,
            },
         });
      if (
         offeredItems.length !==
         offered_item_ids!.length
      ) {
         return res
            .status(
               StatusCodes.UNPROCESSABLE_ENTITY,
            )
            .json({
               success: false,
               message:
                  'One or more offered items were not found.',
            });
      }
      for (const item of offeredItems) {
         if (
            item.userId !==
               proposerId ||
            item.status !== 'available'
         ) {
            return res
               .status(
                  StatusCodes.UNPROCESSABLE_ENTITY,
               )
               .json({
                  success: false,
                  message:
                     'One or more offered items are not available for trade.',
               });
         }
      }
   }

   const trade = await db.$transaction(
      async (tx) => {
         const trade =
            await tx.trade.create({
               data: {
                  proposerId,
                  receiverId:
                     receiver_id,
                  tradeType: trade_type,
                  status: 'negotiating',
                  currentOfferBy:
                     proposerId,
                  awaitingResponseFrom:
                     receiver_id,
                  roundStartedAt:
                     new Date(),
               },
            });

         await tx.tradeItem.create({
            data: {
               tradeId: trade.id,
               itemId: receiver_item_id,
               offeredBy: receiver_id,
               side: 'receiver',
            },
         });

         const itemIdsToLock = [
            receiver_item_id,
         ];
         if (trade_type === 'item') {
            for (const item of offeredItems) {
               await tx.tradeItem.create(
                  {
                     data: {
                        tradeId:
                           trade.id,
                        itemId: item.id,
                        offeredBy:
                           proposerId,
                        side: 'proposer',
                     },
                  },
               );
               itemIdsToLock.push(
                  item.id,
               );
            }
         }

         await tx.item.updateMany({
            where: {
               id: {
                  in: itemIdsToLock,
               },
            },
            data: {
               status: 'in_trade',
            },
         });

         await tx.tradeOffer.create({
            data: {
               tradeId: trade.id,
               offeredBy: proposerId,
               tradeType: trade_type,
               cashAmount:
                  trade_type === 'cash'
                     ? (cash_amount ??
                       null)
                     : null,
               topUpAmount:
                  trade_type === 'item'
                     ? (top_up_amount ??
                       null)
                     : null,
               offeredItemIds:
                  trade_type === 'item'
                     ? (offered_item_ids ??
                       [])
                     : [],
               isCurrent: true,
            },
         });

         if (message) {
            await tx.message.create({
               data: {
                  tradeId: trade.id,
                  senderId: proposerId,
                  body: message,
               },
            });
         }

         return trade;
      },
   );

   // TODO: Notification + push dispatch once notifications module exists (type: trade_request)
   await notify({
      userId: receiver_id,
      type: 'trade_request',
      title: 'New trade proposal',
      body: 'Someone has proposed a trade for one of your items.',
      referenceId: trade.id,
      referenceType: 'Trade',
   });

   const currentOffer =
      await db.tradeOffer.findFirst({
         where: {
            tradeId: trade.id,
            isCurrent: true,
         },
      });
   const offeredItemsFull =
      await resolveOfferedItems(
         (currentOffer?.offeredItemIds as string[]) ??
            [],
      );
   const receiverItemsFull =
      await resolveOfferedItems([
         receiver_item_id,
      ]);

   return res
      .status(StatusCodes.CREATED)
      .json({
         success: true,
         message:
            'Trade proposal sent.',
         data: {
            trade: {
               id: trade.id,
               status: trade.status,
               trade_type:
                  trade.tradeType,
               receiver:
                  formatOwner(receiver),
               proposer_items:
                  formatOfferedItems(
                     offeredItemsFull,
                  ),
               receiver_items:
                  formatOfferedItems(
                     receiverItemsFull,
                  ),
               current_offer:
                  formatCurrentOffer(
                     currentOffer,
                     offeredItemsFull,
                  ),
               awaiting_response_from:
                  trade.awaitingResponseFrom,
            },
         },
      });
}

// -------------------------------------------------------------------------
// POST /trades/:id/rebargain
// -------------------------------------------------------------------------
export async function rebargain(
   req: Request,
   res: Response,
) {
   const id = req.params.id as string;
   const parsed =
      rebargainSchema.safeParse(
         req.body,
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

   let trade = await db.trade.findFirst(
      {
         where: { id, deletedAt: null },
      },
   );
   if (!trade) {
      return res
         .status(StatusCodes.NOT_FOUND)
         .json({
            success: false,
            message: 'Trade not found.',
         });
   }
   trade =
      await expireIfRoundTimedOut(
         trade,
      );

   if (trade.status !== 'negotiating') {
      return res
         .status(
            StatusCodes.UNPROCESSABLE_ENTITY,
         )
         .json({
            success: false,
            message:
               'This trade is not open for negotiation.',
         });
   }

   const userId = req.userId as string;
   if (
      trade.awaitingResponseFrom !==
      userId
   ) {
      return res
         .status(StatusCodes.FORBIDDEN)
         .json({
            success: false,
            message:
               'It is not your turn to respond on this trade.',
         });
   }

   const roundCount =
      await db.tradeOffer.count({
         where: { tradeId: id },
      });
   if (roundCount >= ROUND_LIMIT) {
      return res
         .status(
            StatusCodes.UNPROCESSABLE_ENTITY,
         )
         .json({
            success: false,
            message:
               'Maximum number of negotiation rounds reached.',
         });
   }

   const currentOffer =
      await db.tradeOffer.findFirst({
         where: {
            tradeId: id,
            isCurrent: true,
         },
      });
   if (!currentOffer) {
      return res
         .status(
            StatusCodes.UNPROCESSABLE_ENTITY,
         )
         .json({
            success: false,
            message:
               'No active offer found for this trade.',
         });
   }

   const {
      cash_amount,
      offered_item_ids,
      top_up_amount,
      message,
   } = parsed.data;
   const currentItemIds =
      (currentOffer.offeredItemIds as string[]) ??
      [];

   const itemsChanged =
      offered_item_ids !== undefined &&
      JSON.stringify(
         [...offered_item_ids].sort(),
      ) !==
         JSON.stringify(
            [...currentItemIds].sort(),
         );
   const cashChanged =
      cash_amount !== undefined &&
      Number(cash_amount) !==
         Number(
            currentOffer.cashAmount ??
               0,
         );
   const topUpChanged =
      top_up_amount !== undefined &&
      Number(top_up_amount) !==
         Number(
            currentOffer.topUpAmount ??
               0,
         );

   if (
      !itemsChanged &&
      !cashChanged &&
      !topUpChanged
   ) {
      return res
         .status(
            StatusCodes.UNPROCESSABLE_ENTITY,
         )
         .json({
            success: false,
            message:
               'Counter-offer must differ from the current offer.',
         });
   }

   let newOfferedItemIds =
      currentItemIds;

   if (
      trade.tradeType === 'item' &&
      itemsChanged
   ) {
      const newItems =
         await db.item.findMany({
            where: {
               id: {
                  in: offered_item_ids as string[],
               },
               deletedAt: null,
            },
         });
      if (
         newItems.length !==
         offered_item_ids!.length
      ) {
         return res
            .status(
               StatusCodes.UNPROCESSABLE_ENTITY,
            )
            .json({
               success: false,
               message:
                  'One or more offered items were not found.',
            });
      }
      for (const item of newItems) {
         if (
            item.userId !== userId ||
            item.status !== 'available'
         ) {
            return res
               .status(
                  StatusCodes.UNPROCESSABLE_ENTITY,
               )
               .json({
                  success: false,
                  message:
                     'One or more offered items are not available for trade.',
               });
         }
      }

      const side =
         userId === trade.proposerId
            ? 'proposer'
            : 'receiver';

      await db.$transaction(
         async (tx) => {
            await tx.item.updateMany({
               where: {
                  id: {
                     in: currentItemIds,
                  },
               },
               data: {
                  status: 'available',
               },
            });
            await tx.tradeItem.deleteMany(
               {
                  where: {
                     tradeId: id,
                     side,
                  },
               },
            );
            for (const item of newItems) {
               await tx.tradeItem.create(
                  {
                     data: {
                        tradeId: id,
                        itemId: item.id,
                        offeredBy:
                           userId,
                        side,
                     },
                  },
               );
            }
            await tx.item.updateMany({
               where: {
                  id: {
                     in: newItems.map(
                        (i) => i.id,
                     ),
                  },
               },
               data: {
                  status: 'in_trade',
               },
            });
         },
      );

      newOfferedItemIds =
         offered_item_ids as string[];
   }

   const otherParty =
      userId === trade.proposerId
         ? trade.receiverId
         : trade.proposerId;

   await db.$transaction([
      db.tradeOffer.update({
         where: { id: currentOffer.id },
         data: { isCurrent: false },
      }),
      db.tradeOffer.create({
         data: {
            tradeId: id,
            offeredBy: userId,
            tradeType: trade.tradeType,
            cashAmount:
               cash_amount !== undefined
                  ? cash_amount
                  : currentOffer.cashAmount,
            topUpAmount:
               top_up_amount !==
               undefined
                  ? top_up_amount
                  : currentOffer.topUpAmount,
            offeredItemIds:
               newOfferedItemIds,
            isCurrent: true,
         },
      }),
      db.trade.update({
         where: { id },
         data: {
            currentOfferBy: userId,
            awaitingResponseFrom:
               otherParty,
            roundStartedAt: new Date(),
         },
      }),
   ]);

   if (message) {
      await db.message.create({
         data: {
            tradeId: id,
            senderId: userId,
            body: message,
         },
      });
   }

   // TODO: Notification + push dispatch (type: trade_rebargain)
   await notify({
      userId: otherParty,
      type: 'trade_rebargain',
      title: 'Counter-offer received',
      body: 'A counter-offer has been made on your trade.',
      referenceId: id,
      referenceType: 'Trade',
   });

   const updatedOffer =
      await db.tradeOffer.findFirst({
         where: {
            tradeId: id,
            isCurrent: true,
         },
      });
   const offeredItemsFull =
      await resolveOfferedItems(
         (updatedOffer?.offeredItemIds as string[]) ??
            [],
      );

   return res
      .status(StatusCodes.OK)
      .json({
         success: true,
         message:
            'Counter-offer submitted.',
         data: {
            trade: {
               status: 'negotiating',
               current_offer:
                  formatCurrentOffer(
                     updatedOffer,
                     offeredItemsFull,
                  ),
               awaiting_response_from:
                  otherParty,
            },
         },
      });
}

// -------------------------------------------------------------------------
// PATCH /trades/:id/accept
// -------------------------------------------------------------------------
export async function accept(
   req: Request,
   res: Response,
) {
   const id = req.params.id as string;
   const parsed =
      acceptTradeSchema.safeParse(
         req.body,
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

   let trade = await db.trade.findFirst(
      {
         where: { id, deletedAt: null },
      },
   );
   if (!trade) {
      return res
         .status(StatusCodes.NOT_FOUND)
         .json({
            success: false,
            message: 'Trade not found.',
         });
   }
   trade =
      await expireIfRoundTimedOut(
         trade,
      );

   if (trade.status !== 'negotiating') {
      return res
         .status(
            StatusCodes.UNPROCESSABLE_ENTITY,
         )
         .json({
            success: false,
            message:
               'This trade is not open for negotiation.',
         });
   }

   const userId = req.userId as string;
   if (
      trade.awaitingResponseFrom !==
      userId
   ) {
      return res
         .status(StatusCodes.FORBIDDEN)
         .json({
            success: false,
            message:
               'It is not your turn to respond on this trade.',
         });
   }

   const {
      completion_method,
      meetup_details,
      delivery_details,
   } = parsed.data;

   const currentOffer =
      await db.tradeOffer.findFirst({
         where: {
            tradeId: id,
            isCurrent: true,
         },
      });
   if (!currentOffer) {
      return res
         .status(
            StatusCodes.UNPROCESSABLE_ENTITY,
         )
         .json({
            success: false,
            message:
               'No active offer found for this trade.',
         });
   }

   const agreedAt = new Date();

   const { updatedTrade, transaction } =
      await db.$transaction(
         async (tx) => {
            const updatedTrade =
               await tx.trade.update({
                  where: { id },
                  data: {
                     status: 'accepted',
                     completionMethod:
                        completion_method,
                     meetupDetails:
                        completion_method ===
                        'meetup'
                           ? (meetup_details ??
                             null)
                           : null,
                     deliveryDetails:
                        completion_method ===
                        'delivery'
                           ? (delivery_details ??
                             null)
                           : null,
                  },
               });

            const receiverTradeItem =
               await tx.tradeItem.findFirst(
                  {
                     where: {
                        tradeId: id,
                        side: 'receiver',
                     },
                  },
               );

            const transaction =
               await tx.transaction.create(
                  {
                     data: {
                        tradeId: id,
                        tradeType:
                           trade.tradeType,
                        proposerId:
                           trade.proposerId,
                        receiverId:
                           trade.receiverId,
                        receiverItemId:
                           receiverTradeItem?.itemId ??
                           null,
                        offeredItemIds:
                           currentOffer.offeredItemIds ??
                           [],
                        agreedCashAmount:
                           currentOffer.cashAmount,
                        agreedTopUpAmount:
                           currentOffer.topUpAmount,
                        status:
                           'pending_completion',
                        agreedAt,
                     },
                  },
               );

            return {
               updatedTrade,
               transaction,
            };
         },
      );

   // TODO: Notification + push dispatch (type: trade_accepted)
   const other =
      userId === trade.proposerId
         ? trade.receiverId
         : trade.proposerId;
   await notify({
      userId: other,
      type: 'trade_accepted',
      title: 'Trade accepted', // accept
      body: 'Terms are agreed. Chat is now unlocked.',
      referenceId: id,
      referenceType: 'Trade',
   });

   return res
      .status(StatusCodes.OK)
      .json({
         success: true,
         message:
            'Trade accepted. Terms agreed.',
         data: {
            trade: {
               status:
                  updatedTrade.status,
               completion_method:
                  updatedTrade.completionMethod,
               meetup_details:
                  updatedTrade.meetupDetails,
               delivery_details:
                  updatedTrade.deliveryDetails,
               agreed_at: agreedAt,
            },
            transaction: {
               id: transaction.id,
            },
         },
      });
}

// -------------------------------------------------------------------------
// PATCH /trades/:id/decline
// -------------------------------------------------------------------------
export async function decline(
   req: Request,
   res: Response,
) {
   const id = req.params.id as string;
   let trade = await db.trade.findFirst(
      {
         where: { id, deletedAt: null },
      },
   );
   if (!trade) {
      return res
         .status(StatusCodes.NOT_FOUND)
         .json({
            success: false,
            message: 'Trade not found.',
         });
   }
   trade =
      await expireIfRoundTimedOut(
         trade,
      );

   if (trade.status !== 'negotiating') {
      return res
         .status(
            StatusCodes.UNPROCESSABLE_ENTITY,
         )
         .json({
            success: false,
            message:
               'This trade is not open for negotiation.',
         });
   }

   const userId = req.userId as string;
   if (
      trade.awaitingResponseFrom !==
      userId
   ) {
      return res
         .status(StatusCodes.FORBIDDEN)
         .json({
            success: false,
            message:
               'It is not your turn to respond on this trade.',
         });
   }

   const itemIds = (
      await db.tradeItem.findMany({
         where: { tradeId: id },
         select: { itemId: true },
      })
   ).map((ti) => ti.itemId);

   await db.$transaction([
      db.trade.update({
         where: { id },
         data: { status: 'declined' },
      }),
      db.item.updateMany({
         where: { id: { in: itemIds } },
         data: { status: 'available' },
      }),
   ]);

   // TODO: Notification + push dispatch (type: trade_declined)
   const other =
      userId === trade.proposerId
         ? trade.receiverId
         : trade.proposerId;
   await notify({
      userId: other,
      type: 'trade_declined',
      title: 'Trade declined', // decline
      body: 'Your trade proposal was declined.',
      referenceId: id,
      referenceType: 'Trade',
   });

   return res
      .status(StatusCodes.OK)
      .json({
         success: true,
         message: 'Trade declined.',
         data: {
            trade: {
               id,
               status: 'declined',
            },
         },
      });
}

// -------------------------------------------------------------------------
// PATCH /trades/:id/cancel
// -------------------------------------------------------------------------
export async function cancel(
   req: Request,
   res: Response,
) {
   const id = req.params.id as string;
   const trade =
      await db.trade.findFirst({
         where: { id, deletedAt: null },
      });
   if (!trade) {
      return res
         .status(StatusCodes.NOT_FOUND)
         .json({
            success: false,
            message: 'Trade not found.',
         });
   }

   const userId = req.userId as string;
   if (trade.proposerId !== userId) {
      return res
         .status(StatusCodes.FORBIDDEN)
         .json({
            success: false,
            message:
               'Only the proposer can cancel this trade.',
         });
   }
   if (trade.status !== 'negotiating') {
      return res
         .status(
            StatusCodes.UNPROCESSABLE_ENTITY,
         )
         .json({
            success: false,
            message:
               'Only trades in negotiation can be cancelled.',
         });
   }

   const itemIds = (
      await db.tradeItem.findMany({
         where: { tradeId: id },
         select: { itemId: true },
      })
   ).map((ti) => ti.itemId);

   await db.$transaction([
      db.trade.update({
         where: { id },
         data: {
            status: 'cancelled',
            cancelledAt: new Date(),
            cancelledBy: userId,
         },
      }),
      db.item.updateMany({
         where: { id: { in: itemIds } },
         data: { status: 'available' },
      }),
   ]);

   // TODO: Notification + push dispatch (type: trade_cancelled)
   await notify({
      userId: trade.receiverId,
      type: 'trade_cancelled',
      title: 'Trade cancelled',
      body: 'The proposer cancelled this trade.',
      referenceId: id,
      referenceType: 'Trade',
   });

   return res
      .status(StatusCodes.OK)
      .json({
         success: true,
         message: 'Trade cancelled.',
         data: {
            trade: {
               id,
               status: 'cancelled',
            },
         },
      });
}

// -------------------------------------------------------------------------
// PATCH /trades/:id/complete
// -------------------------------------------------------------------------
export async function complete(
   req: Request,
   res: Response,
) {
   const id = req.params.id as string;
   const trade =
      await db.trade.findFirst({
         where: { id, deletedAt: null },
      });
   if (!trade) {
      return res
         .status(StatusCodes.NOT_FOUND)
         .json({
            success: false,
            message: 'Trade not found.',
         });
   }

   const userId = req.userId as string;
   const isProposer =
      trade.proposerId === userId;
   const isReceiver =
      trade.receiverId === userId;
   if (!isProposer && !isReceiver) {
      return res
         .status(StatusCodes.FORBIDDEN)
         .json({
            success: false,
            message:
               'You are not a participant in this trade.',
         });
   }
   if (trade.status !== 'accepted') {
      return res
         .status(
            StatusCodes.UNPROCESSABLE_ENTITY,
         )
         .json({
            success: false,
            message:
               'Only accepted trades can be completed.',
         });
   }

   const data: Record<string, boolean> =
      {};
   if (isProposer)
      data.proposerConfirmed = true;
   if (isReceiver)
      data.receiverConfirmed = true;

   let updated = await db.trade.update({
      where: { id },
      data,
   });

   if (
      updated.proposerConfirmed &&
      updated.receiverConfirmed
   ) {
      const itemIds = (
         await db.tradeItem.findMany({
            where: { tradeId: id },
            select: { itemId: true },
         })
      ).map((ti) => ti.itemId);
      const completedAt = new Date();

      await db.$transaction([
         db.trade.update({
            where: { id },
            data: {
               status: 'completed',
               completedAt,
            },
         }),
         db.item.updateMany({
            where: {
               id: { in: itemIds },
            },
            data: { status: 'traded' },
         }),
         db.transaction.update({
            where: { tradeId: id },
            data: {
               status: 'completed',
               completedAt,
            },
         }),
      ]);
      updated = {
         ...updated,
         status: 'completed',
      };
      // TODO: Notification + push dispatch to both parties (type: trade_completed)
      await notify(
         [
            trade.proposerId,
            trade.receiverId,
         ].map((uid) => ({
            userId: uid,
            type: 'trade_completed' as const,
            title: 'Trade completed',
            body: 'Both parties confirmed. You can now rate each other.',
            referenceId: id,
            referenceType:
               'Trade' as const,
         })),
      );
   } else {
      // TODO: Notification + push dispatch prompting the other party to confirm
      await notify({
         userId: isProposer
            ? trade.receiverId
            : trade.proposerId,
         type: 'trade_pending',
         title: 'Confirm trade completion',
         body: 'The other party confirmed the exchange. Please confirm on your side.',
         referenceId: id,
         referenceType: 'Trade',
      });
   }

   return res
      .status(StatusCodes.OK)
      .json({
         success: true,
         message:
            updated.status ===
            'completed'
               ? 'Trade completed!'
               : 'Completion confirmed. Waiting for the other party to confirm.',
         data: {
            trade: {
               id,
               status: updated.status,
               proposer_confirmed:
                  updated.proposerConfirmed,
               receiver_confirmed:
                  updated.receiverConfirmed,
            },
         },
      });
}

// -------------------------------------------------------------------------
// GET /trades
// -------------------------------------------------------------------------
export async function index(
   req: Request,
   res: Response,
) {
   const parsed =
      listTradesQuerySchema.safeParse(
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
      status,
      cursor,
      limit = 20,
   } = parsed.data;

   const where: any = {
      deletedAt: null,
      OR: [
         { proposerId: userId },
         { receiverId: userId },
      ],
   };
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
      where.AND = [
         {
            OR: [
               {
                  createdAt: {
                     lt: c.date,
                  },
               },
               {
                  createdAt: c.date,
                  id: { lt: c.id },
               },
            ],
         },
      ];
   }

   const trades =
      await db.trade.findMany({
         where,
         include: {
            proposer: true,
            receiver: true,
            tradeItems: {
               include: {
                  item: {
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
            },
            tradeOffers: {
               where: {
                  isCurrent: true,
               },
            },
            messages: {
               where: {
                  deletedAt: null,
               },
               orderBy: [
                  { createdAt: 'desc' },
                  { id: 'desc' },
               ],
               take: 1,
            },
         },
         orderBy: { updatedAt: 'desc' },
         take: limit + 1,
      });

   const hasMore =
      trades.length > limit;
   const page = trades.slice(0, limit);
   const last = page.at(-1);
   const nextCursor =
      hasMore && last
         ? encodeCursor(
              last.createdAt,
              last.id,
           )
         : null;

   const formatted = await Promise.all(
      page.map(async (trade) => {
         const otherParty =
            trade.proposerId === userId
               ? trade.receiver
               : trade.proposer;
         const myItemsPreview =
            trade.tradeItems
               .filter((ti) =>
                  trade.proposerId ===
                  userId
                     ? ti.side ===
                       'proposer'
                     : ti.side ===
                       'receiver',
               )
               .map(
                  (ti) =>
                     ti.item.images[0]
                        ?.url,
               )
               .filter(Boolean);
         const theirItemsPreview =
            trade.tradeItems
               .filter((ti) =>
                  trade.proposerId ===
                  userId
                     ? ti.side ===
                       'receiver'
                     : ti.side ===
                       'proposer',
               )
               .map(
                  (ti) =>
                     ti.item.images[0]
                        ?.url,
               )
               .filter(Boolean);
         const currentOffer =
            trade.tradeOffers[0];
         const offeredItemsFull =
            currentOffer
               ? await resolveOfferedItems(
                    (currentOffer.offeredItemIds as string[]) ??
                       [],
                 )
               : [];
         const lastMessage =
            trade.messages[0];
         const unreadCount =
            await db.message.count({
               where: {
                  tradeId: trade.id,
                  senderId: {
                     not: userId,
                  },
                  readAt: null,
                  deletedAt: null,
               },
            });

         return {
            id: trade.id,
            status: trade.status,
            trade_type: trade.tradeType,
            other_party:
               formatOwner(otherParty),
            my_items_preview:
               myItemsPreview,
            their_items_preview:
               theirItemsPreview,
            current_offer:
               trade.status ===
                  'negotiating' &&
               currentOffer
                  ? formatCurrentOffer(
                       currentOffer,
                       offeredItemsFull,
                    )
                  : null,
            last_message: lastMessage
               ? {
                    body: lastMessage.body,
                    created_at:
                       lastMessage.createdAt,
                 }
               : null,
            unread_count: unreadCount,
            updated_at: trade.updatedAt,
         };
      }),
   );

   return res
      .status(StatusCodes.OK)
      .json({
         success: true,
         message: 'Trades retrieved.',
         data: {
            trades: formatted,
            next_cursor: nextCursor,
         },
      });
}

// -------------------------------------------------------------------------
// GET /trades/:id
// -------------------------------------------------------------------------
export async function show(
   req: Request,
   res: Response,
) {
   const id = req.params.id as string;
   let trade = await db.trade.findFirst(
      {
         where: { id, deletedAt: null },
         include: {
            proposer: true,
            receiver: true,
            tradeItems: {
               include: {
                  item: {
                     include: {
                        images: true,
                        valuation: true,
                     },
                  },
               },
            },
            tradeOffers: {
               orderBy: {
                  createdAt: 'asc',
               },
            },
            messages: {
               where: {
                  deletedAt: null,
               },
               orderBy: {
                  createdAt: 'desc',
               },
               take: 2,
            },
            dispute: true,
            ratings: true,
         },
      },
   );

   if (!trade) {
      return res
         .status(StatusCodes.NOT_FOUND)
         .json({
            success: false,
            message: 'Trade not found.',
         });
   }

   const userId = req.userId as string;
   if (
      trade.proposerId !== userId &&
      trade.receiverId !== userId
   ) {
      return res
         .status(StatusCodes.FORBIDDEN)
         .json({
            success: false,
            message:
               'You are not a participant in this trade.',
         });
   }

   const expiryResult =
      await expireIfRoundTimedOut(
         trade,
      );
   if (
      expiryResult.status !==
      trade.status
   )
      trade = {
         ...trade,
         status: expiryResult.status,
      };

   const proposerItems =
      trade.tradeItems
         .filter(
            (ti) =>
               ti.side === 'proposer',
         )
         .map((ti) => ti.item);
   const receiverItems =
      trade.tradeItems
         .filter(
            (ti) =>
               ti.side === 'receiver',
         )
         .map((ti) => ti.item);
   const currentOfferRow =
      trade.tradeOffers.find(
         (o) => o.isCurrent,
      );
   const offeredItemsFull =
      currentOfferRow
         ? await resolveOfferedItems(
              (currentOfferRow.offeredItemIds as string[]) ??
                 [],
           )
         : [];

   return res
      .status(StatusCodes.OK)
      .json({
         success: true,
         message: 'Trade retrieved.',
         data: {
            trade: {
               id: trade.id,
               status: trade.status,
               trade_type:
                  trade.tradeType,
               proposer: formatOwner(
                  trade.proposer,
               ),
               receiver: formatOwner(
                  trade.receiver,
               ),
               proposer_items:
                  formatOfferedItems(
                     proposerItems,
                  ),
               receiver_items:
                  formatOfferedItems(
                     receiverItems,
                  ),
               current_offer:
                  currentOfferRow
                     ? formatCurrentOffer(
                          currentOfferRow,
                          offeredItemsFull,
                       )
                     : null,
               offer_history:
                  trade.tradeOffers.map(
                     (o) => ({
                        id: o.id,
                        offered_by:
                           o.offeredBy,
                        trade_type:
                           o.tradeType,
                        cash_amount:
                           o.cashAmount,
                        top_up_amount:
                           o.topUpAmount,
                        offered_item_ids:
                           o.offeredItemIds,
                        is_current:
                           o.isCurrent,
                        created_at:
                           o.createdAt,
                     }),
                  ),
               awaiting_response_from:
                  trade.status ===
                  'negotiating'
                     ? trade.awaitingResponseFrom
                     : null,
               completion_method:
                  trade.completionMethod,
               proposer_confirmed:
                  trade.proposerConfirmed,
               receiver_confirmed:
                  trade.receiverConfirmed,
               meetup_details:
                  trade.meetupDetails,
               delivery_details:
                  trade.deliveryDetails,
               recent_messages:
                  trade.messages.map(
                     (m) => ({
                        id: m.id,
                        sender_id:
                           m.senderId,
                        body: m.body,
                        created_at:
                           m.createdAt,
                     }),
                  ),
               dispute: trade.dispute
                  ? {
                       id: trade.dispute
                          .id,
                       status:
                          trade.dispute
                             .status,
                       reason:
                          trade.dispute
                             .reason,
                    }
                  : null,
               ratings:
                  trade.ratings.map(
                     (r) => ({
                        id: r.id,
                        rater_id:
                           r.raterId,
                        rated_id:
                           r.ratedId,
                        score: r.score,
                        review:
                           r.review,
                        created_at:
                           r.createdAt,
                     }),
                  ),
            },
         },
      });
}
