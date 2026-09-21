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
   sendMessageSchema,
   listMessagesQuerySchema,
} from '../validators/message.validators';

// Statuses where chat has not unlocked yet ('pending' is legacy).
const LOCKED_STATUSES = [
   'negotiating',
   'pending',
];

function formatMessage(m: {
   id: string;
   senderId: string;
   body: string;
   readAt: Date | null;
   createdAt: Date;
}) {
   return {
      id: m.id,
      sender_id: m.senderId,
      body: m.body,
      read_at: m.readAt,
      created_at: m.createdAt,
   };
}

// Composite (createdAt, id) cursor — ids are random v4 UUIDs, so an
// id-only cursor can't follow chronological order.
function encodeCursor(m: {
   createdAt: Date;
   id: string;
}) {
   return Buffer.from(
      `${m.createdAt.toISOString()}|${m.id}`,
   ).toString('base64url');
}

function decodeCursor(
   cursor: string,
): {
   createdAt: Date;
   id: string;
} | null {
   try {
      const [iso, id] = Buffer.from(
         cursor,
         'base64url',
      )
         .toString()
         .split('|');
      if (!iso || !id) return null;
      const createdAt = new Date(iso);
      if (
         Number.isNaN(
            createdAt.getTime(),
         )
      )
         return null;
      return { createdAt, id };
   } catch {
      return null;
   }
}

function chatNotUnlocked(
   res: Response,
) {
   return res
      .status(
         StatusCodes.UNPROCESSABLE_ENTITY,
      )
      .json({
         success: false,
         code: 'CHAT_NOT_UNLOCKED',
         message:
            'Chat unlocks once both parties have agreed on the trade terms.',
      });
}

function tradeClosed(res: Response) {
   return res
      .status(
         StatusCodes.UNPROCESSABLE_ENTITY,
      )
      .json({
         success: false,
         code: 'TRADE_CLOSED',
         message:
            'This trade is closed. Messaging is disabled.',
      });
}

// Loads the trade and enforces 404 → 403 (participant) ordering,
// matching show() / complete() in trade.controllers.ts.
// Returns null after sending the error response.
async function loadParticipantTrade(
   req: Request,
   res: Response,
) {
   const id = req.params.id as string;
   const trade =
      await db.trade.findFirst({
         where: { id, deletedAt: null },
      });
   if (!trade) {
      res.status(
         StatusCodes.NOT_FOUND,
      ).json({
         success: false,
         message: 'Trade not found.',
      });
      return null;
   }

   const userId = req.userId as string;
   if (
      trade.proposerId !== userId &&
      trade.receiverId !== userId
   ) {
      res.status(
         StatusCodes.FORBIDDEN,
      ).json({
         success: false,
         message:
            'You are not a participant in this trade.',
      });
      return null;
   }
   return trade;
}

// -------------------------------------------------------------------------
// GET /trades/:id/messages
// -------------------------------------------------------------------------
export async function index(
   req: Request,
   res: Response,
) {
   const parsed =
      listMessagesQuerySchema.safeParse(
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

   const trade =
      await loadParticipantTrade(
         req,
         res,
      );
   if (!trade) return;
   if (
      LOCKED_STATUSES.includes(
         trade.status,
      )
   )
      return chatNotUnlocked(res);

   const userId = req.userId as string;
   const { cursor, limit = 20 } =
      parsed.data;

   const where: any = {
      tradeId: trade.id,
      deletedAt: null,
   };
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
      where.OR = [
         {
            createdAt: {
               lt: c.createdAt,
            },
         },
         {
            createdAt: c.createdAt,
            id: { lt: c.id },
         },
      ];
   }

   // Newest-first so the cursor walks toward older messages.
   const rows =
      await db.message.findMany({
         where,
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
         ? encodeCursor(last)
         : null;

   // Mark only the returned page's unread messages from the other party.
   const unreadIds = new Set(
      page
         .filter(
            (m) =>
               m.senderId !== userId &&
               m.readAt === null,
         )
         .map((m) => m.id),
   );
   const now = new Date();
   if (unreadIds.size > 0) {
      await db.message.updateMany({
         where: {
            id: { in: [...unreadIds] },
            readAt: null,
         },
         data: { readAt: now },
      });
   }

   // Each page is returned chronologically (oldest → newest).
   const messages = page
      .map((m) =>
         formatMessage(
            unreadIds.has(m.id)
               ? { ...m, readAt: now }
               : m,
         ),
      )
      .reverse();

   return res
      .status(StatusCodes.OK)
      .json({
         success: true,
         message: 'Messages retrieved.',
         data: {
            messages,
            next_cursor: nextCursor,
         },
      });
}

// -------------------------------------------------------------------------
// POST /trades/:id/messages
// -------------------------------------------------------------------------
export async function store(
   req: Request,
   res: Response,
) {
   const parsed =
      sendMessageSchema.safeParse(
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

   const trade =
      await loadParticipantTrade(
         req,
         res,
      );
   if (!trade) return;
   if (
      LOCKED_STATUSES.includes(
         trade.status,
      )
   )
      return chatNotUnlocked(res);
   if (trade.status !== 'accepted')
      return tradeClosed(res);

   const message =
      await db.message.create({
         data: {
            tradeId: trade.id,
            senderId:
               req.userId as string,
            body: parsed.data.body,
         },
      });

   // TODO: Notification + push dispatch to the other party (type: new_message)

   return res
      .status(StatusCodes.CREATED)
      .json({
         success: true,
         message: 'Message sent.',
         data: {
            message:
               formatMessage(message),
         },
      });
}

// -------------------------------------------------------------------------
// PATCH /trades/:id/messages/read
// -------------------------------------------------------------------------
export async function markRead(
   req: Request,
   res: Response,
) {
   const trade =
      await loadParticipantTrade(
         req,
         res,
      );
   if (!trade) return;

   // No status gate: intro messages written during negotiation count
   // toward unread_count, and this is the only way to clear them.
   const result =
      await db.message.updateMany({
         where: {
            tradeId: trade.id,
            senderId: {
               not: req.userId as string,
            },
            readAt: null,
            deletedAt: null,
         },
         data: { readAt: new Date() },
      });

   return res
      .status(StatusCodes.OK)
      .json({
         success: true,
         message:
            'Messages marked as read.',
         data: {
            marked_read: result.count,
         },
      });
}

// -------------------------------------------------------------------------
// DELETE /trades/:id/messages/:messageId  (not in spec — sender soft-delete)
// -------------------------------------------------------------------------
export async function destroy(
   req: Request,
   res: Response,
) {
   const messageId = req.params
      .messageId as string;

   const trade =
      await loadParticipantTrade(
         req,
         res,
      );
   if (!trade) return;
   if (
      LOCKED_STATUSES.includes(
         trade.status,
      )
   )
      return chatNotUnlocked(res);
   if (trade.status !== 'accepted')
      return tradeClosed(res);

   const message =
      await db.message.findFirst({
         where: {
            id: messageId,
            tradeId: trade.id,
            deletedAt: null,
         },
      });
   if (!message) {
      return res
         .status(StatusCodes.NOT_FOUND)
         .json({
            success: false,
            message:
               'Message not found.',
         });
   }
   if (
      message.senderId !== req.userId
   ) {
      return res
         .status(StatusCodes.FORBIDDEN)
         .json({
            success: false,
            message:
               'You can only delete your own messages.',
         });
   }

   await db.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
   });

   return res
      .status(StatusCodes.OK)
      .json({
         success: true,
         message: 'Message deleted.',
      });
}
