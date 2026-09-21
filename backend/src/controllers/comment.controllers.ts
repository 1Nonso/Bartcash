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
   createCommentSchema,
   listCommentsQuerySchema,
} from '../validators/comment.validators';
import {
   encodeCursor,
   decodeCursor,
} from '../utils/cursor';

function formatComment(c: any) {
   return {
      id: c.id,
      body: c.body,
      user: {
         id: c.user.id,
         first_name: c.user.firstName,
         last_name: c.user.lastName,
         profile_photo:
            c.user.profilePhoto,
      },
      created_at: c.createdAt,
   };
}

async function findActiveItem(
   id: string,
) {
   return db.item.findFirst({
      where: { id, deletedAt: null },
      select: {
         id: true,
         userId: true,
      },
   });
}

// -------------------------------------------------------------------------
// GET /items/:id/comments   (public — no auth)
// -------------------------------------------------------------------------
export async function index(
   req: Request,
   res: Response,
) {
   const id = req.params.id as string;
   const parsed =
      listCommentsQuerySchema.safeParse(
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

   const item =
      await findActiveItem(id);
   if (!item) {
      return res
         .status(StatusCodes.NOT_FOUND)
         .json({
            success: false,
            message: 'Item not found.',
         });
   }

   const { cursor, limit = 20 } =
      parsed.data;
   const where: any = { listingId: id };
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

   // Newest first (addendum left the order open — decided at build time).
   const rows =
      await db.comment.findMany({
         where,
         include: { user: true },
         orderBy: [
            { createdAt: 'desc' },
            { id: 'desc' },
         ],
         take: limit + 1,
      });

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
         message: 'Comments retrieved.',
         data: {
            comments: page.map(
               formatComment,
            ),
            next_cursor: nextCursor,
         },
      });
}

// -------------------------------------------------------------------------
// POST /items/:id/comments
// -------------------------------------------------------------------------
export async function store(
   req: Request,
   res: Response,
) {
   const id = req.params.id as string;
   const parsed =
      createCommentSchema.safeParse(
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

   const item =
      await findActiveItem(id);
   if (!item) {
      return res
         .status(StatusCodes.NOT_FOUND)
         .json({
            success: false,
            message: 'Item not found.',
         });
   }

   const comment =
      await db.comment.create({
         data: {
            listingId: id,
            userId:
               req.userId as string,
            body: parsed.data.body,
         },
         include: { user: true },
      });

   // TODO: notify the listing owner (type: new_comment) — the spec doesn't
   // define a comment notification, so none is created yet.

   return res
      .status(StatusCodes.CREATED)
      .json({
         success: true,
         message: 'Comment posted.',
         data: {
            comment:
               formatComment(comment),
         },
      });
}

// -------------------------------------------------------------------------
// DELETE /comments/:id   (author or listing owner — hard delete)
// -------------------------------------------------------------------------
export async function destroy(
   req: Request,
   res: Response,
) {
   const id = req.params.id as string;
   const comment =
      await db.comment.findUnique({
         where: { id },
         include: {
            listing: {
               select: { userId: true },
            },
         },
      });
   if (!comment) {
      return res
         .status(StatusCodes.NOT_FOUND)
         .json({
            success: false,
            message:
               'Comment not found.',
         });
   }

   const userId = req.userId as string;
   if (
      comment.userId !== userId &&
      comment.listing.userId !== userId
   ) {
      return res
         .status(StatusCodes.FORBIDDEN)
         .json({
            success: false,
            message:
               'Only the comment author or the listing owner can delete this comment.',
         });
   }

   await db.comment.delete({
      where: { id },
   });

   return res
      .status(StatusCodes.OK)
      .json({
         success: true,
         message: 'Comment deleted.',
      });
}
