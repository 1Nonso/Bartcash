import type {
   Request,
   Response,
} from 'express';
import { db } from '../config/db.config';
import {
   ReasonPhrases,
   StatusCodes,
} from 'http-status-codes';
import { Prisma } from '../generated/prisma/client';
import { createDisputeSchema } from '../validators/dispute.validators';
import { notify } from '../services/notification.service';

function disputeExists(res: Response) {
   return res
      .status(StatusCodes.CONFLICT)
      .json({
         success: false,
         code: 'DISPUTE_EXISTS',
         message:
            'A dispute already exists for this trade.',
      });
}

// -------------------------------------------------------------------------
// POST /disputes
// -------------------------------------------------------------------------
export async function store(
   req: Request,
   res: Response,
) {
   const parsed =
      createDisputeSchema.safeParse(
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

   const userId = req.userId as string;
   const { trade_id, reason } =
      parsed.data;

   const trade =
      await db.trade.findFirst({
         where: {
            id: trade_id,
            deletedAt: null,
         },
      });
   if (!trade) {
      return res
         .status(StatusCodes.NOT_FOUND)
         .json({
            success: false,
            message: 'Trade not found.',
         });
   }
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

   // Checked before the status rule: raising a dispute sets the trade to
   // 'disputed', so a duplicate would otherwise fail on status (422)
   // and DISPUTE_EXISTS (409) would be unreachable.
   const existing =
      await db.dispute.findUnique({
         where: { tradeId: trade.id },
      });
   if (existing)
      return disputeExists(res);

   if (
      ![
         'accepted',
         'completed',
      ].includes(trade.status)
   ) {
      return res
         .status(
            StatusCodes.UNPROCESSABLE_ENTITY,
         )
         .json({
            success: false,
            code: 'INVALID_TRADE_STATUS',
            message:
               'Trade must be accepted or completed to raise a dispute.',
         });
   }

   try {
      const dispute =
         await db.$transaction(
            async (tx) => {
               const created =
                  await tx.dispute.create(
                     {
                        data: {
                           tradeId:
                              trade.id,
                           raisedBy:
                              userId,
                           reason,
                           status:
                              'open',
                        },
                     },
                  );
               await tx.trade.update({
                  where: {
                     id: trade.id,
                  },
                  data: {
                     status: 'disputed',
                  },
               });
               return created;
            },
         );

      await notify(
         [
            trade.proposerId,
            trade.receiverId,
         ].map((uid) => ({
            userId: uid,
            type: 'dispute_raised' as const,
            title: 'Dispute raised',
            body:
               uid === userId
                  ? 'Your dispute has been submitted and will be reviewed.'
                  : 'A dispute has been raised on one of your trades.',
            referenceId: dispute.id,
            referenceType:
               'Dispute' as const,
         })),
      );

      return res
         .status(StatusCodes.CREATED)
         .json({
            success: true,
            message: 'Dispute raised.',
            data: {
               dispute: {
                  id: dispute.id,
                  status:
                     dispute.status,
                  reason:
                     dispute.reason,
               },
            },
         });
   } catch (err) {
      // disputes.trade_id is unique — covers a concurrent duplicate.
      if (
         err instanceof
            Prisma.PrismaClientKnownRequestError &&
         err.code === 'P2002'
      ) {
         return disputeExists(res);
      }
      throw err;
   }
}

// -------------------------------------------------------------------------
// GET /disputes/:id
// -------------------------------------------------------------------------
export async function show(
   req: Request,
   res: Response,
) {
   const id = req.params.id as string;
   const dispute =
      await db.dispute.findUnique({
         where: { id },
         include: {
            raisedByUser: true,
            trade: {
               include: {
                  proposer: true,
                  receiver: true,
               },
            },
         },
      });
   if (!dispute) {
      return res
         .status(StatusCodes.NOT_FOUND)
         .json({
            success: false,
            code: 'DISPUTE_NOT_FOUND',
            message:
               'Dispute not found.',
         });
   }

   const userId = req.userId as string;
   const { trade } = dispute;
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

   const raiser = dispute.raisedByUser;
   return res
      .status(StatusCodes.OK)
      .json({
         success: true,
         message: 'Dispute retrieved.',
         data: {
            dispute: {
               id: dispute.id,
               status: dispute.status,
               reason: dispute.reason,
               raised_by: {
                  id: raiser.id,
                  first_name:
                     raiser.firstName,
                  last_name:
                     raiser.lastName,
                  profile_photo:
                     raiser.profilePhoto,
               },
               resolution_notes:
                  dispute.resolutionNotes,
               created_at:
                  dispute.createdAt,
               trade: {
                  id: trade.id,
                  status: trade.status,
                  trade_type:
                     trade.tradeType,
                  proposer: {
                     id: trade.proposer
                        .id,
                     first_name:
                        trade.proposer
                           .firstName,
                     last_name:
                        trade.proposer
                           .lastName,
                  },
                  receiver: {
                     id: trade.receiver
                        .id,
                     first_name:
                        trade.receiver
                           .firstName,
                     last_name:
                        trade.receiver
                           .lastName,
                  },
                  completion_method:
                     trade.completionMethod,
                  completed_at:
                     trade.completedAt,
               },
            },
         },
      });
}
