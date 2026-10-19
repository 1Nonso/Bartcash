import type {
   Request,
   Response,
} from 'express';
import {
   StatusCodes,
   ReasonPhrases,
} from 'http-status-codes';
import { db } from '../config/db.config';
import {
   uploadToR2,
   deleteFromR2,
} from '../utils/storage.utils';
import { pushTokenSchema } from '../validators/user.validators';
import { randomBytes } from 'node:crypto';
import { getTasteSummary } from '../services/taste.service';
import { deleteTasteData } from '../services/tasteCleanup';
import { qlooConfig } from '../config/qloo.config';

class DeletionBlockedError extends Error {
   constructor(
      public tradeIds: string[],
   ) {
      super(
         'Account has accepted or disputed trades.',
      );
   }
}

export async function getProfile(
   req: Request,
   res: Response,
) {
   const [user, taste] =
      await Promise.all([
         db.user.findUnique({
            where: { id: req.userId! },
            select: {
               id: true,
               firstName: true,
               lastName: true,
               email: true,
               profilePhoto: true,
               bio: true,
               location: true,
               averageRating: true,
               totalTrades: true,
               emailVerifiedAt: true,
               createdAt: true,
            },
         }),
         getTasteSummary(req.userId!),
      ]);

   return res
      .status(StatusCodes.OK)
      .json({
         success: true,
         message: 'Profile retrieved.',
         data: {
            user: user
               ? { ...user, taste }
               : user,
            features: {
               qloo: qlooConfig.enabled,
            },
         },
      });
}

export async function updateProfile(
   req: Request,
   res: Response,
) {
   const updated = await db.user.update(
      {
         where: { id: req.userId! },
         data: req.body,
         select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePhoto: true,
            bio: true,
            location: true,
            averageRating: true,
            totalTrades: true,
            createdAt: true,
         },
      },
   );

   return res
      .status(StatusCodes.OK)
      .json({
         success: true,
         message: 'Profile updated.',
         data: { user: updated },
      });
}

export async function updateAvatar(
   req: Request,
   res: Response,
) {
   if (!req.file) {
      return res
         .status(
            StatusCodes.BAD_REQUEST,
         )
         .json({
            success: false,
            message:
               ReasonPhrases.BAD_REQUEST,
            description:
               'Please provide an image file.',
         });
   }

   const user =
      await db.user.findUniqueOrThrow({
         where: { id: req.userId! },
      });

   if (user.profilePhoto) {
      await deleteFromR2(
         user.profilePhoto,
      );
   }

   const key = `avatars/${user.id}_${Date.now()}.${req.file.mimetype.split('/')[1]}`;
   const url = await uploadToR2(
      req.file.buffer,
      key,
      req.file.mimetype,
   );

   await db.user.update({
      where: { id: user.id },
      data: { profilePhoto: url },
   });

   return res
      .status(StatusCodes.OK)
      .json({
         success: true,
         message: 'Avatar updated.',
         data: { profile_photo: url },
      });
}

export async function deleteAccount(
   req: Request,
   res: Response,
) {
   const userId = req.userId!;
   let avatarToRemove: string | null =
      null;

   try {
      await db.$transaction(
         async (tx) => {
            const now = new Date();

            await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;

            const user =
               await tx.user.findUnique(
                  {
                     where: {
                        id: userId,
                     },
                     select: {
                        profilePhoto: true,
                        deletedAt: true,
                     },
                  },
               );
            if (!user || user.deletedAt)
               return;

            const blocking =
               await tx.trade.findMany({
                  where: {
                     status: {
                        in: [
                           'accepted',
                           'disputed',
                        ],
                     },
                     OR: [
                        {
                           proposerId:
                              userId,
                        },
                        {
                           receiverId:
                              userId,
                        },
                     ],
                  },
                  select: { id: true },
               });
            if (blocking.length > 0) {
               throw new DeletionBlockedError(
                  blocking.map(
                     (t) => t.id,
                  ),
               );
            }

            // 2. Cancel open trades, release items, notify the other party
            const openTrades =
               await tx.trade.findMany({
                  where: {
                     status: {
                        in: [
                           'negotiating',
                        ],
                     },
                     OR: [
                        {
                           proposerId:
                              userId,
                        },
                        {
                           receiverId:
                              userId,
                        },
                     ],
                  },
                  select: {
                     id: true,
                     proposerId: true,
                     receiverId: true,
                     tradeItems: {
                        select: {
                           itemId: true,
                        },
                     },
                  },
               });

            if (openTrades.length > 0) {
               const tradeIds =
                  openTrades.map(
                     (t) => t.id,
                  );
               const itemIds =
                  openTrades.flatMap(
                     (t) =>
                        t.tradeItems.map(
                           (ti) =>
                              ti.itemId,
                        ),
                  );

               await tx.trade.updateMany(
                  {
                     where: {
                        id: {
                           in: tradeIds,
                        },
                     },
                     data: {
                        status:
                           'cancelled',
                        cancelledAt:
                           now,
                        cancelledBy:
                           userId,
                        awaitingResponseFrom:
                           null,
                     },
                  },
               );

               // Release items, unless they're still tied up in another live trade
               await tx.item.updateMany(
                  {
                     where: {
                        id: {
                           in: itemIds,
                        },
                        status:
                           'in_trade',
                        tradeItems: {
                           none: {
                              trade: {
                                 status:
                                    {
                                       in: [
                                          'negotiating',
                                          'accepted',
                                          'disputed',
                                       ],
                                    },
                              },
                           },
                        },
                     },
                     data: {
                        status:
                           'available',
                     },
                  },
               );

               await tx.notification.createMany(
                  {
                     data: openTrades.map(
                        (t) => ({
                           userId:
                              t.proposerId ===
                              userId
                                 ? t.receiverId
                                 : t.proposerId,
                           type: 'trade_cancelled',
                           title: 'Trade cancelled',
                           body: 'The other user deleted their account, so this trade was cancelled.',
                           referenceId:
                              t.id,
                           referenceType:
                              'trade',
                        }),
                     ),
                  },
               );
            }

            // 3. Revoke all refresh tokens
            await tx.refreshToken.updateMany(
               {
                  where: {
                     userId,
                     revoked: false,
                  },
                  data: {
                     revoked: true,
                     revokedAt: now,
                  },
               },
            );

            // 4. Soft-delete the user's items (keep 'traded' status for history)
            await tx.item.updateMany({
               where: {
                  userId,
                  deletedAt: null,
                  status: {
                     not: 'traded',
                  },
               },
               data: {
                  deletedAt: now,
                  status: 'inactive',
               },
            });
            await tx.item.updateMany({
               where: {
                  userId,
                  deletedAt: null,
               },
               data: { deletedAt: now },
            });

            await deleteTasteData(
               tx,
               userId,
            );

            // 5. Soft delete + anonymise the user
            avatarToRemove =
               user.profilePhoto;
            await tx.user.update({
               where: { id: userId },
               data: {
                  deletedAt: now,
                  isActive: false,
                  email: `deleted+${userId}@invalid.local`,
                  // password is NOT NULL: replace with an unusable value
                  password:
                     randomBytes(
                        48,
                     ).toString('hex'),
                  firstName: 'Deleted',
                  lastName: 'User',
                  bio: null,
                  location: null,
                  profilePhoto: null,
                  pushToken: null,
               },
            });
         },
         { timeout: 15_000 },
      );
   } catch (err) {
      if (
         err instanceof
         DeletionBlockedError
      ) {
         return res
            .status(
               StatusCodes.CONFLICT,
            )
            .json({
               success: false,
               message:
                  ReasonPhrases.CONFLICT,
               description:
                  'Complete or resolve your accepted and disputed trades before deleting your account.',
               blockingTradeIds:
                  err.tradeIds,
            });
      }
      throw err;
   }

   if (avatarToRemove) {
      try {
         await deleteFromR2(
            avatarToRemove,
         );
      } catch (e) {
         console.error(
            'R2 avatar cleanup failed',
            {
               userId,
               avatar: avatarToRemove,
               e,
            },
         );
      }
   }

   // await db.refreshToken.updateMany({
   //    where: { userId, revoked: false },
   //    data: {
   //       revoked: true,
   //       revokedAt: new Date(),
   //    },
   // });
   //
   // await db.user.delete({
   //    where: { id: userId },
   // }); // hard delete — swap to soft delete if `deletedAt` exists on User
   //
   // // Deferred until Trades/Notifications are migrated:
   // // - cancel pending trade proposals where this user is the proposer
   // // - notify active trading partners that this user deleted their account

   return res
      .status(StatusCodes.OK)
      .json({
         success: true,
         message:
            'Account deleted successfully.',
      });
}

export async function updatePushToken(
   req: Request,
   res: Response,
) {
   const parsed =
      pushTokenSchema.safeParse(
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

   const { push_token } = parsed.data;

   await db.$transaction([
      db.user.updateMany({
         where: {
            pushToken: push_token,
            id: {
               not: req.userId as string,
            },
         },
         data: { pushToken: null },
      }),
      db.user.update({
         where: { id: req.userId! },
         data: {
            pushToken: push_token,
         },
      }),
   ]);
   return res
      .status(StatusCodes.OK)
      .json({
         success: true,
         message: 'Push token saved.',
      });
}
