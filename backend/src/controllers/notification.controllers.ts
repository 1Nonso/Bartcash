import type {
   Request,
   Response,
} from 'express';
import { db } from '../config/db.config';
import {
   ReasonPhrases,
   StatusCodes,
} from 'http-status-codes';
import { listNotificationsQuerySchema } from '../validators/notification.validators';
import {
   encodeCursor,
   decodeCursor,
} from '../utils/cursor';

function formatNotification(n: any) {
   return {
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      reference_id: n.referenceId,
      reference_type: n.referenceType,
      read_at: n.readAt,
      created_at: n.createdAt,
   };
}

// Loads a notification and enforces 404 → 403 (ownership).
// Returns null after sending the error response.
async function loadOwnNotification(
   req: Request,
   res: Response,
) {
   const id = req.params.id as string;
   const notification =
      await db.notification.findUnique({
         where: { id },
      });
   if (!notification) {
      res.status(
         StatusCodes.NOT_FOUND,
      ).json({
         success: false,
         message:
            'Notification not found.',
      });
      return null;
   }
   if (
      notification.userId !== req.userId
   ) {
      res.status(
         StatusCodes.FORBIDDEN,
      ).json({
         success: false,
         message:
            'This notification does not belong to you.',
      });
      return null;
   }
   return notification;
}

// -------------------------------------------------------------------------
// GET /notifications
// -------------------------------------------------------------------------
export async function index(
   req: Request,
   res: Response,
) {
   const parsed =
      listNotificationsQuerySchema.safeParse(
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
   const { cursor, limit = 20 } =
      parsed.data;

   const where: any = { userId };
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

   const [rows, unreadCount] =
      await Promise.all([
         db.notification.findMany({
            where,
            orderBy: [
               { createdAt: 'desc' },
               { id: 'desc' },
            ],
            take: limit + 1,
         }),
         db.notification.count({
            where: {
               userId,
               readAt: null,
            },
         }),
      ]);

   const hasMore = rows.length > limit;
   const page = rows.slice(0, limit);
   const last = page.at(-1);
   const nextCursor =
      hasMore && last
         ? encodeCursor(
              last.createdAt,
              last.id,
           )
         : null;

   return res
      .status(StatusCodes.OK)
      .json({
         success: true,
         message:
            'Notifications retrieved.',
         data: {
            notifications: page.map(
               formatNotification,
            ),
            unread_count: unreadCount,
            next_cursor: nextCursor,
         },
      });
}

// -------------------------------------------------------------------------
// PATCH /notifications/:id/read
// -------------------------------------------------------------------------
export async function markRead(
   req: Request,
   res: Response,
) {
   const notification =
      await loadOwnNotification(
         req,
         res,
      );
   if (!notification) return;

   // Idempotent: already read → return the existing timestamp.
   const readAt =
      notification.readAt ??
      (
         await db.notification.update({
            where: {
               id: notification.id,
            },
            data: {
               readAt: new Date(),
            },
         })
      ).readAt;

   return res
      .status(StatusCodes.OK)
      .json({
         success: true,
         message:
            'Notification marked as read.',
         data: {
            notification: {
               id: notification.id,
               read_at: readAt,
            },
         },
      });
}

// -------------------------------------------------------------------------
// PATCH /notifications/read-all
// -------------------------------------------------------------------------
export async function markAllRead(
   req: Request,
   res: Response,
) {
   const result =
      await db.notification.updateMany({
         where: {
            userId:
               req.userId as string,
            readAt: null,
         },
         data: { readAt: new Date() },
      });

   return res
      .status(StatusCodes.OK)
      .json({
         success: true,
         message:
            'All notifications marked as read.',
         data: {
            marked_read: result.count,
         },
      });
}

// -------------------------------------------------------------------------
// DELETE /notifications/:id   (hard delete, per spec)
// -------------------------------------------------------------------------
export async function destroy(
   req: Request,
   res: Response,
) {
   const notification =
      await loadOwnNotification(
         req,
         res,
      );
   if (!notification) return;

   await db.notification.delete({
      where: { id: notification.id },
   });

   return res
      .status(StatusCodes.OK)
      .json({
         success: true,
         message:
            'Notification deleted.',
      });
}
