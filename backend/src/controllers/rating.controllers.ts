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
import {
   submitRatingSchema,
   listRatingsQuerySchema,
} from '../validators/rating.validators';
import {
   encodeCursor,
   decodeCursor,
} from '../utils/cursor';

function formatRater(user: any) {
   return {
      id: user.id,
      first_name: user.firstName,
      last_name: user.lastName,
      profile_photo: user.profilePhoto,
   };
}

function alreadyRated(res: Response) {
   return res
      .status(StatusCodes.CONFLICT)
      .json({
         success: false,
         code: 'ALREADY_RATED',
         message:
            'You have already rated this trade.',
      });
}

// -------------------------------------------------------------------------
// POST /ratings
// -------------------------------------------------------------------------
export async function store(
   req: Request,
   res: Response,
) {
   const parsed =
      submitRatingSchema.safeParse(
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

   const raterId = req.userId as string;
   const { trade_id, score, review } =
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
      trade.proposerId !== raterId &&
      trade.receiverId !== raterId
   ) {
      return res
         .status(StatusCodes.FORBIDDEN)
         .json({
            success: false,
            message:
               'You are not a participant in this trade.',
         });
   }
   if (trade.status !== 'completed') {
      return res
         .status(
            StatusCodes.UNPROCESSABLE_ENTITY,
         )
         .json({
            success: false,
            code: 'TRADE_NOT_COMPLETED',
            message:
               'Only completed trades can be rated.',
         });
   }

   const existing =
      await db.rating.findUnique({
         where: {
            tradeId_raterId: {
               tradeId: trade.id,
               raterId,
            },
         },
      });
   if (existing)
      return alreadyRated(res);

   const ratedId =
      trade.proposerId === raterId
         ? trade.receiverId
         : trade.proposerId;

   try {
      const rating =
         await db.$transaction(
            async (tx) => {
               // Serialise concurrent ratings on the same trade so the
               // "first rating" check below can't double-count.
               await tx.$queryRaw`SELECT id FROM trades WHERE id = ${trade.id}::uuid FOR UPDATE`;

               const created =
                  await tx.rating.create(
                     {
                        data: {
                           tradeId:
                              trade.id,
                           raterId,
                           ratedId,
                           score,
                           review:
                              review
                                 ? review
                                 : null,
                        },
                     },
                  );

               const agg =
                  await tx.rating.aggregate(
                     {
                        where: {
                           ratedId,
                           deletedAt:
                              null,
                        },
                        _avg: {
                           score: true,
                        },
                     },
                  );
               await tx.user.update({
                  where: {
                     id: ratedId,
                  },
                  data: {
                     averageRating:
                        Number(
                           (
                              agg._avg
                                 .score ??
                              0
                           ).toFixed(2),
                        ),
                  },
               });

               // Spec: total_trades is counted only on the first rating
               // submitted for a trade — it applies to both participants.
               const ratingsForTrade =
                  await tx.rating.count(
                     {
                        where: {
                           tradeId:
                              trade.id,
                        },
                     },
                  );
               if (
                  ratingsForTrade === 1
               ) {
                  await tx.user.updateMany(
                     {
                        where: {
                           id: {
                              in: [
                                 trade.proposerId,
                                 trade.receiverId,
                              ],
                           },
                        },
                        data: {
                           totalTrades:
                              {
                                 increment: 1,
                              },
                        },
                     },
                  );
               }

               return created;
            },
         );

      return res
         .status(StatusCodes.CREATED)
         .json({
            success: true,
            message:
               'Rating submitted.',
            data: {
               rating: {
                  id: rating.id,
                  score: rating.score,
                  review: rating.review,
               },
            },
         });
   } catch (err) {
      if (
         err instanceof
            Prisma.PrismaClientKnownRequestError &&
         err.code === 'P2002'
      ) {
         return alreadyRated(res);
      }
      throw err;
   }
}

// -------------------------------------------------------------------------
// GET /users/:id/ratings
// -------------------------------------------------------------------------
export async function indexForUser(
   req: Request,
   res: Response,
) {
   const id = req.params.id as string;
   const parsed =
      listRatingsQuerySchema.safeParse(
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

   const user = await db.user.findFirst(
      {
         where: { id, deletedAt: null },
      },
   );
   if (!user) {
      return res
         .status(StatusCodes.NOT_FOUND)
         .json({
            success: false,
            message: 'User not found.',
         });
   }

   const { cursor, limit = 20 } =
      parsed.data;
   const where: any = {
      ratedId: id,
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

   const [rows, totalRatings] =
      await Promise.all([
         db.rating.findMany({
            where,
            include: { rater: true },
            orderBy: [
               { createdAt: 'desc' },
               { id: 'desc' },
            ],
            take: limit + 1,
         }),
         db.rating.count({
            where: {
               ratedId: id,
               deletedAt: null,
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
         message: 'Ratings retrieved.',
         data: {
            ratings: page.map((r) => ({
               id: r.id,
               score: r.score,
               review: r.review,
               rater: formatRater(
                  r.rater,
               ),
               created_at: r.createdAt,
            })),
            average_rating:
               user.averageRating,
            total_ratings: totalRatings,
            next_cursor: nextCursor,
         },
      });
}
