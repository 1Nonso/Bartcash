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

export async function getProfile(
   req: Request,
   res: Response,
) {
   const user =
      await db.user.findUnique({
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
      });

   return res
      .status(StatusCodes.OK)
      .json({
         success: true,
         message: 'Profile retrieved.',
         data: { user },
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

   await db.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: {
         revoked: true,
         revokedAt: new Date(),
      },
   });

   await db.user.delete({
      where: { id: userId },
   }); // hard delete — swap to soft delete if `deletedAt` exists on User

   // Deferred until Trades/Notifications are migrated:
   // - cancel pending trade proposals where this user is the proposer
   // - notify active trading partners that this user deleted their account

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
   await db.user.update({
      where: {
         id: req.userId as string,
      },
      data: {
         pushToken:
            parsed.data.push_token,
      },
   });
   return res
      .status(StatusCodes.OK)
      .json({
         success: true,
         message: 'Push token saved.',
      });
}
