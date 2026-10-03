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
   createItemSchema,
   updateItemSchema,
   listItemsQuerySchema,
   overrideValuationSchema,
} from '../validators/item.validators';
import {
   uploadToR2,
   deleteFromR2,
} from '../services/r2.service';
import { enqueueItemValuation } from '../queue/itemValuation.queue';
import { Prisma } from '../generated/prisma/client';
import {
   decodeCursor,
   encodeCursor,
} from '../utils/cursor';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

const IMAGE_LIMIT = 6;

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

function formatOwner(
   user: any,
   { extended = false } = {},
) {
   return {
      id: user.id,
      first_name: user.firstName,
      last_name: user.lastName,
      profile_photo: user.profilePhoto,
      average_rating:
         user.averageRating,
      ...(extended
         ? {
              total_trades:
                 user.totalTrades,
           }
         : {}),
   };
}

function checkDeclaredValueOutlier(
   declaredValue: number,
   valuation: {
      valueMin: any;
      valueMax: any;
   } | null,
): string | null {
   if (
      !valuation ||
      valuation.valueMin == null ||
      valuation.valueMax == null
   ) {
      return null;
   }

   const min = Number(
      valuation.valueMin,
   );
   const max = Number(
      valuation.valueMax,
   );
   const lowerBound = min * 0.6; // 40% below the AI's low end
   const upperBound = max * 1.4; // 40% above the AI's high end

   if (declaredValue < lowerBound) {
      return 'Your declared value is significantly below our estimate. You may want to double-check it.';
   }
   if (declaredValue > upperBound) {
      return 'Your declared value is significantly above our estimate. You may want to double-check it.';
   }
   return null;
}

// -------------------------------------------------------------------------
// POST /items
// -------------------------------------------------------------------------
export async function create(
   req: Request,
   res: Response,
) {
   const files =
      (req.files as
         | Express.Multer.File[]
         | undefined) ?? [];
   if (files.length === 0)
      return res.status(400).json({
         success: false,
         message:
            'Please upload at least one image.',
      });

   const parsed =
      createItemSchema.safeParse(
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

   const {
      category_id,
      desired_trade,
      is_service,
      ...rest
   } = parsed.data;

   const category =
      await db.category.findFirst({
         where: {
            id: category_id,
            isActive: true,
         },
      });

   if (!category) {
      return res
         .status(StatusCodes.NOT_FOUND)
         .json({
            success: false,
            message:
               'The selected category is invalid or inactive.',
            errors: {
               category_id: [
                  'Category not found.',
               ],
            },
         });
   }

   const itemId = randomUUID();
   const uploaded: {
      key: string;
      url: string;
   }[] = [];
   try {
      for (const [i, file] of files
         .slice(0, IMAGE_LIMIT)
         .entries()) {
         const key = `items/${itemId}/${Date.now()}_${i}.${file.originalname.split('.').pop()}`;
         uploaded.push({
            key,
            url: await uploadToR2(
               key,
               file.buffer,
               file.mimetype,
            ),
         });
      }
      const { item, valuation } =
         await db.$transaction(
            async (tx) => {
               const item =
                  await tx.item.create({
                     data: {
                        id: itemId,
                        title: rest.title,
                        description:
                           rest.description,
                        condition:
                           rest.condition,
                        userId:
                           req.userId as string,
                        categoryId:
                           category_id,
                        desiredTrade:
                           desired_trade ??
                           null,
                        isService:
                           is_service ??
                           false,
                        status: 'draft',
                        ...(rest.location !==
                        undefined
                           ? {
                                location:
                                   rest.location,
                             }
                           : {}),
                        images: {
                           create:
                              uploaded.map(
                                 (
                                    u,
                                    i,
                                 ) => ({
                                    url: u.url,
                                    isPrimary:
                                       i ===
                                       0,
                                    displayOrder:
                                       i,
                                 }),
                              ),
                        },
                     },
                  });
               const valuation =
                  await tx.itemValuation.create(
                     {
                        data: {
                           itemId,
                           status:
                              'pending',
                           currency:
                              'USD',
                        },
                     },
                  );
               return {
                  item,
                  valuation,
               };
            },
         );
      try {
         await enqueueItemValuation({
            itemId,
            valuationId: valuation.id,
         });
      } catch {
         await db.itemValuation.update({
            where: { id: valuation.id },
            data: {
               status: 'failed',
               failedReason:
                  'queue_unavailable',
            }, // user can hit Retry
         });
      }
      return res
         .status(StatusCodes.CREATED)
         .json({
            success: true,
            message:
               'Item listing created.',
            data: {
               item: {
                  id: item.id,
                  title: item.title,
                  status: item.status,
                  valuation_status:
                     'pending',
               },
            },
         });
   } catch (err) {
      await Promise.allSettled(
         uploaded.map((u) =>
            deleteFromR2(u.key),
         ),
      ); // nothing left behind
      return res.status(500).json({
         success: false,
         message:
            'Could not create the listing. Please try again.',
      });
   }
}

export async function publish(
   req: Request,
   res: Response,
) {
   const parsed = z
      .object({
         user_declared_value: z
            .number()
            .positive(),
      })
      .safeParse(req.body);
   if (!parsed.success)
      return res.status(400).json({
         success: false,
         message:
            ReasonPhrases.BAD_REQUEST,
         errors:
            parsed.error.flatten()
               .fieldErrors,
      });
   const id = req.params.id as string;
   const item = await db.item.findFirst(
      {
         where: { id, deletedAt: null },
         include: {
            valuation: true,
            images: {
               select: { id: true },
               take: 1,
            },
         },
      },
   );
   if (!item)
      return res.status(404).json({
         success: false,
         message: 'Item not found.',
      });
   if (item.userId !== req.userId)
      return res.status(403).json({
         success: false,
         message:
            'You do not have permission to publish this item.',
      });
   if (item.status !== 'draft')
      return res.status(422).json({
         success: false,
         message:
            'This listing is already published.',
      });
   if (item.images.length === 0)
      return res.status(422).json({
         success: false,
         message:
            'Add at least one image first.',
      });

   const updated = await db.item.update(
      {
         where: { id },
         data: {
            status: 'available',
            userDeclaredValue:
               parsed.data
                  .user_declared_value,
         },
      },
   );
   const warning =
      checkDeclaredValueOutlier(
         parsed.data
            .user_declared_value,
         item.valuation,
      );
   return res.status(200).json({
      success: true,
      message: 'Listing published.',
      data: {
         item: {
            id: updated.id,
            status: updated.status,
         },
      },
      ...(warning
         ? {
              warnings: {
                 user_declared_value:
                    warning,
              },
           }
         : {}), // soft, never blocks
   });
}

// -------------------------------------------------------------------------
// POST /items/:id/images
// -------------------------------------------------------------------------
export async function uploadImages(
   req: Request,
   res: Response,
) {
   const id = req.params.id as string;
   const files = req.files as
      Express.Multer.File[] | undefined;

   if (!files || files.length === 0) {
      return res
         .status(
            StatusCodes.BAD_REQUEST,
         )
         .json({
            success: false,
            message:
               'Please upload at least one image.',
         });
   }

   const item = await db.item.findFirst(
      {
         where: { id, deletedAt: null },
      },
   );
   if (!item) {
      return res
         .status(StatusCodes.NOT_FOUND)
         .json({
            success: false,
            message: 'Item not found.',
         });
   }
   if (item.userId !== req.userId) {
      return res
         .status(StatusCodes.FORBIDDEN)
         .json({
            success: false,
            message:
               'You do not have permission to upload images for this item.',
         });
   }

   const existingCount =
      await db.itemImage.count({
         where: { itemId: id },
      });
   if (existingCount >= IMAGE_LIMIT) {
      return res
         .status(
            StatusCodes.BAD_REQUEST,
         )
         .json({
            success: false,
            message:
               'This item already has the maximum of 6 images.',
         });
   }

   const remainingSlots =
      IMAGE_LIMIT - existingCount;
   const filesToUpload = files.slice(
      0,
      remainingSlots,
   );
   const uploadedImages = [];

   for (const [
      index,
      file,
   ] of filesToUpload.entries()) {
      const ext = file.originalname
         .split('.')
         .pop();
      const key = `items/${id}/${Date.now()}_${index}.${ext}`;
      const url = await uploadToR2(
         key,
         file.buffer,
         file.mimetype,
      );
      const isPrimary =
         existingCount === 0 &&
         index === 0;

      const image =
         await db.itemImage.create({
            data: {
               itemId: id,
               url,
               isPrimary,
               displayOrder:
                  existingCount + index,
            },
         });

      uploadedImages.push(image);
   }

   // itemId is unique on item_valuations (one row per item), so this can't
   // assume "first ever" — upsert covers both a brand-new item and a retry
   // where a row already exists.
   const valuation =
      await db.itemValuation.upsert({
         where: { itemId: id },
         update: {
            status: 'pending',
            failedReason: null,
            valueMin: null,
            valueMax: null,
            confidence: null,
            rawResponse: Prisma.DbNull,
         },
         create: {
            itemId: id,
            status: 'pending',
            currency: 'USD',
         },
      });

   await enqueueItemValuation({
      itemId: id,
      valuationId: valuation.id,
   });

   return res
      .status(StatusCodes.CREATED)
      .json({
         success: true,
         message:
            'Images uploaded. Valuation triggered.',
         data: {
            images: uploadedImages.map(
               (img) => ({
                  id: img.id,
                  url: img.url,
                  is_primary:
                     img.isPrimary,
                  display_order:
                     img.displayOrder,
               }),
            ),
            valuation_status: 'pending',
         },
      });
}

// -------------------------------------------------------------------------
// GET /items
// -------------------------------------------------------------------------
export async function index(
   req: Request,
   res: Response,
) {
   const parsed =
      listItemsQuerySchema.safeParse(
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

   const {
      search,
      category_id,
      condition,
      value_min,
      value_max,
      is_service,
      cursor,
      limit = 20,
   } = parsed.data;
   const userId = req.userId as string;

   const where: any = {
      status: 'available',
      deletedAt: null,
      userId: { not: userId },
      images: { some: {} },
   };

   if (search) {
      where.OR = [
         {
            title: {
               contains: search,
               mode: 'insensitive',
            },
         },
         {
            description: {
               contains: search,
               mode: 'insensitive',
            },
         },
      ];
   }
   if (category_id)
      where.categoryId = category_id;
   if (condition)
      where.condition = condition;
   if (is_service !== undefined)
      where.isService = is_service;
   if (
      value_min !== undefined ||
      value_max !== undefined
   ) {
      where.valuation = {
         is: {
            ...(value_min !== undefined
               ? {
                    valueMax: {
                       gte: value_min,
                    },
                 }
               : {}),
            ...(value_max !== undefined
               ? {
                    valueMin: {
                       lte: value_max,
                    },
                 }
               : {}),
         },
      };
   }

   const total = await db.item.count({
      where,
   });

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

   const items = await db.item.findMany(
      {
         where,
         include: {
            images: {
               where: {
                  isPrimary: true,
               },
               take: 1,
            },
            valuation: true,
            user: true,
         },
         orderBy: [
            { createdAt: 'desc' },
            { id: 'desc' },
         ],
         take: limit + 1,
      },
   );

   const hasMore = items.length > limit;
   const page = items.slice(0, limit);
   const last = page.at(-1);
   const nextCursor =
      hasMore && last
         ? encodeCursor(
              last.createdAt,
              last.id,
           )
         : null;

   const formatted = page.map(
      (item) => ({
         id: item.id,
         title: item.title,
         condition: item.condition,
         is_service: item.isService,
         location: item.location,
         primary_image:
            item.images[0]?.url ?? null,
         valuation: formatValuation(
            item.valuation,
         ),
         owner: formatOwner(item.user),
         created_at: item.createdAt,
      }),
   );

   return res
      .status(StatusCodes.OK)
      .json({
         success: true,
         message: 'Listings retrieved.',
         data: {
            items: formatted,
            next_cursor: nextCursor,
            total,
         },
      });
}

// -------------------------------------------------------------------------
// GET /items/mine
// -------------------------------------------------------------------------
export async function mine(
   req: Request,
   res: Response,
) {
   const userId = req.userId as string;
   const status = req.query.status as
      string | undefined;
   const limit = Number(
      req.query.limit ?? 20,
   );
   const cursor = req.query.cursor as
      string | undefined;
   const allowedStatuses = [
      'available',
      'in_trade',
      'traded',
      'inactive',
   ];

   const where: any = {
      userId,
      deletedAt: null,
   };
   if (
      status &&
      allowedStatuses.includes(status)
   )
      where.status = status;

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

   const items = await db.item.findMany(
      {
         where,
         include: {
            images: {
               where: {
                  isPrimary: true,
               },
               take: 1,
            },
            valuation: true,
         },
         orderBy: [
            { createdAt: 'desc' },
            { id: 'desc' },
         ],
         take: limit + 1,
      },
   );

   const hasMore = items.length > limit;
   const page = items.slice(0, limit);
   const last = page.at(-1);
   const nextCursor =
      hasMore && last
         ? encodeCursor(
              last.createdAt,
              last.id,
           )
         : null;

   const formatted = page.map(
      (item) => ({
         id: item.id,
         title: item.title,
         condition: item.condition,
         status: item.status,
         is_service: item.isService,
         location: item.location,
         primary_image:
            item.images[0]?.url ?? null,
         valuation: formatValuation(
            item.valuation,
         ),
         created_at: item.createdAt,
      }),
   );

   return res
      .status(StatusCodes.OK)
      .json({
         success: true,
         message:
            'Your listings retrieved.',
         data: {
            items: formatted,
            next_cursor: nextCursor,
         },
      });
}

// -------------------------------------------------------------------------
// GET /items/:id
// -------------------------------------------------------------------------
export async function show(
   req: Request,
   res: Response,
) {
   const id = req.params.id as string;

   const item = await db.item.findFirst(
      {
         where: { id, deletedAt: null },
         include: {
            images: {
               orderBy: {
                  displayOrder: 'asc',
               },
            },
            valuation: true,
            user: true,
            category: true,
         },
      },
   );

   if (!item) {
      return res
         .status(StatusCodes.NOT_FOUND)
         .json({
            success: false,
            message: 'Item not found.',
         });
   }

   return res
      .status(StatusCodes.OK)
      .json({
         success: true,
         message: 'Item retrieved.',
         data: {
            item: {
               id: item.id,
               title: item.title,
               description:
                  item.description,
               condition:
                  item.condition,
               desired_trade:
                  item.desiredTrade,
               is_service:
                  item.isService,
               status: item.status,
               location: item.location,
               user_declared_value:
                  item.userDeclaredValue,
               category: {
                  id: item.category.id,
                  name: item.category
                     .name,
                  slug: item.category
                     .slug,
               },
               images: item.images.map(
                  (img) => ({
                     id: img.id,
                     url: img.url,
                     is_primary:
                        img.isPrimary,
                     display_order:
                        img.displayOrder,
                  }),
               ),
               valuation:
                  formatValuation(
                     item.valuation,
                  ),
               owner: formatOwner(
                  item.user,
                  { extended: true },
               ),
               created_at:
                  item.createdAt,
            },
         },
      });
}

// -------------------------------------------------------------------------
// PUT /items/:id
// -------------------------------------------------------------------------
export async function update(
   req: Request,
   res: Response,
) {
   const id = req.params.id as string;
   const parsed =
      updateItemSchema.safeParse(
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

   const item = await db.item.findFirst(
      {
         where: { id, deletedAt: null },
      },
   );
   if (!item) {
      return res
         .status(StatusCodes.NOT_FOUND)
         .json({
            success: false,
            message: 'Item not found.',
         });
   }
   if (item.userId !== req.userId) {
      return res
         .status(StatusCodes.FORBIDDEN)
         .json({
            success: false,
            message:
               'You do not have permission to edit this item.',
         });
   }
   if (
      ['in_trade', 'traded'].includes(
         item.status,
      )
   ) {
      return res
         .status(
            StatusCodes.UNPROCESSABLE_ENTITY,
         )
         .json({
            success: false,
            message:
               'This item cannot be edited while in an active trade.',
         });
   }

   const {
      category_id,
      desired_trade,
      ...rest
   } = parsed.data;

   const descriptionChanged =
      rest.description !== undefined &&
      rest.description !==
         item.description;
   const conditionChanged =
      rest.condition !== undefined &&
      rest.condition !== item.condition;

   const data: Record<string, unknown> =
      {};
   if (rest.title !== undefined)
      data.title = rest.title;
   if (rest.description !== undefined)
      data.description =
         rest.description;
   if (rest.condition !== undefined)
      data.condition = rest.condition;
   if (rest.location !== undefined)
      data.location = rest.location;
   if (category_id !== undefined)
      data.categoryId = category_id;
   if (desired_trade !== undefined)
      data.desiredTrade = desired_trade;
   if (
      rest.user_declared_value !==
      undefined
   )
      data.userDeclaredValue =
         rest.user_declared_value;

   const updated = await db.item.update(
      {
         where: { id },
         data,
         include: {
            images: true,
            valuation: true,
            category: true,
         },
      },
   );

   let warnings:
      | Record<string, string>
      | undefined;
   if (
      rest.user_declared_value !==
         undefined &&
      updated.valuation
   ) {
      const warning =
         checkDeclaredValueOutlier(
            rest.user_declared_value,
            updated.valuation,
         );
      if (warning)
         warnings = {
            user_declared_value:
               warning,
         };
   }

   if (
      descriptionChanged ||
      conditionChanged
   ) {
      const valuation =
         await db.itemValuation.upsert({
            where: { itemId: id },
            update: {
               status: 'pending',
               failedReason: null,
               valueMin: null,
               valueMax: null,
               confidence: null,
               rawResponse:
                  Prisma.DbNull,
            },
            create: {
               itemId: id,
               status: 'pending',
               currency: 'USD',
            },
         });
      await enqueueItemValuation({
         itemId: id,
         valuationId: valuation.id,
      });
   }

   return res
      .status(StatusCodes.OK)
      .json({
         success: true,
         message: 'Listing updated.',
         data: { item: updated },
         ...(warnings
            ? { warnings }
            : {}),
      });
}

// -------------------------------------------------------------------------
// PATCH /items/:id/deactivate
// -------------------------------------------------------------------------
export async function deactivate(
   req: Request,
   res: Response,
) {
   const id = req.params.id as string;
   const item = await db.item.findFirst(
      {
         where: { id, deletedAt: null },
      },
   );

   if (!item) {
      return res
         .status(StatusCodes.NOT_FOUND)
         .json({
            success: false,
            message: 'Item not found.',
         });
   }
   if (item.userId !== req.userId) {
      return res
         .status(StatusCodes.FORBIDDEN)
         .json({
            success: false,
            message:
               'You do not have permission to deactivate this item.',
         });
   }
   if (item.status === 'in_trade') {
      return res
         .status(
            StatusCodes.UNPROCESSABLE_ENTITY,
         )
         .json({
            success: false,
            message:
               'Cannot deactivate an item that is currently in a trade.',
         });
   }

   const updated = await db.item.update(
      {
         where: { id },
         data: { status: 'inactive' },
      },
   );

   return res
      .status(StatusCodes.OK)
      .json({
         success: true,
         message:
            'Listing deactivated.',
         data: {
            item: {
               id: updated.id,
               status: updated.status,
            },
         },
      });
}

// -------------------------------------------------------------------------
// DELETE /items/:id
// -------------------------------------------------------------------------
export async function destroy(
   req: Request,
   res: Response,
) {
   const id = req.params.id as string;
   const item = await db.item.findFirst(
      {
         where: { id, deletedAt: null },
      },
   );

   if (!item) {
      return res
         .status(StatusCodes.NOT_FOUND)
         .json({
            success: false,
            message: 'Item not found.',
         });
   }
   if (item.userId !== req.userId) {
      return res
         .status(StatusCodes.FORBIDDEN)
         .json({
            success: false,
            message:
               'You do not have permission to delete this item.',
         });
   }
   if (
      ['in_trade', 'traded'].includes(
         item.status,
      )
   ) {
      return res
         .status(
            StatusCodes.UNPROCESSABLE_ENTITY,
         )
         .json({
            success: false,
            message:
               'Cannot delete an item that is in an active trade or has been traded.',
         });
   }

   // items.deleted_at exists → soft delete, matching Laravel's SoftDeletes
   // trait behavior on ->delete(), not a hard row delete.
   await db.item.update({
      where: { id },
      data: { deletedAt: new Date() },
   });

   return res
      .status(StatusCodes.OK)
      .json({
         success: true,
         message: 'Listing deleted.',
      });
}

// -------------------------------------------------------------------------
// GET /items/:id/valuation
// -------------------------------------------------------------------------
export async function valuation(
   req: Request,
   res: Response,
) {
   const id = req.params.id as string;
   const item = await db.item.findFirst(
      {
         where: { id, deletedAt: null },
      },
   );

   if (!item) {
      return res
         .status(StatusCodes.NOT_FOUND)
         .json({
            success: false,
            message: 'Item not found.',
         });
   }

   const valuationRecord =
      await db.itemValuation.findUnique(
         {
            where: {
               itemId: id,
            },
         },
      );

   if (!valuationRecord) {
      return res
         .status(StatusCodes.NOT_FOUND)
         .json({
            success: false,
            message:
               'No valuation found for this item.',
         });
   }

   return res
      .status(StatusCodes.OK)
      .json({
         success: true,
         message:
            'Valuation retrieved.',
         data: {
            valuation: formatValuation(
               valuationRecord,
            ),
         },
      });
}

// -------------------------------------------------------------------------
// POST /items/:id/valuation/retry
// -------------------------------------------------------------------------
export async function retryValuation(
   req: Request,
   res: Response,
) {
   const id = req.params.id as string;
   const item = await db.item.findFirst(
      {
         where: { id, deletedAt: null },
         include: { images: true },
      },
   );

   if (!item) {
      return res
         .status(StatusCodes.NOT_FOUND)
         .json({
            success: false,
            message: 'Item not found.',
         });
   }
   if (item.userId !== req.userId) {
      return res
         .status(StatusCodes.FORBIDDEN)
         .json({
            success: false,
            message:
               'You do not have permission to retry valuation for this item.',
         });
   }
   if (item.images.length === 0) {
      return res
         .status(
            StatusCodes.UNPROCESSABLE_ENTITY,
         )
         .json({
            success: false,
            message:
               'Please upload at least one image before retrying valuation.',
         });
   }

   const existing =
      await db.itemValuation.findUnique(
         {
            where: {
               itemId: id,
            },
         },
      );
   if (
      !existing ||
      existing.status !== 'failed'
   ) {
      return res
         .status(
            StatusCodes.UNPROCESSABLE_ENTITY,
         )
         .json({
            success: false,
            message:
               'Valuation retry is only available for failed valuations.',
         });
   }

   const updated =
      await db.itemValuation.update({
         where: { itemId: id },
         data: {
            status: 'pending',
            failedReason: null,
            valueMin: null,
            valueMax: null,
            confidence: null,
            rawResponse: Prisma.DbNull,
         },
      });

   await enqueueItemValuation({
      itemId: id,
      valuationId: updated.id,
   });

   return res
      .status(StatusCodes.OK)
      .json({
         success: true,
         message:
            'Valuation retry triggered.',
         data: {
            valuation: {
               id: updated.id,
               status: 'pending',
            },
         },
      });
}

// -------------------------------------------------------------------------
// PATCH /items/:id/valuation/override
// -------------------------------------------------------------------------
export async function overrideValuation(
   req: Request,
   res: Response,
) {
   const id = req.params.id as string;
   const parsed =
      overrideValuationSchema.safeParse(
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

   const item = await db.item.findFirst(
      {
         where: { id, deletedAt: null },
      },
   );
   if (!item) {
      return res
         .status(StatusCodes.NOT_FOUND)
         .json({
            success: false,
            message: 'Item not found.',
         });
   }
   if (item.userId !== req.userId) {
      return res
         .status(StatusCodes.FORBIDDEN)
         .json({
            success: false,
            message:
               'You do not have permission to override this valuation.',
         });
   }

   const existing =
      await db.itemValuation.findUnique(
         { where: { itemId: id } },
      );
   if (!existing) {
      return res
         .status(StatusCodes.NOT_FOUND)
         .json({
            success: false,
            message:
               'No valuation record found for this item.',
         });
   }

   const updated =
      await db.itemValuation.update({
         where: { itemId: id },
         data: {
            valueMin:
               parsed.data.value_min,
            valueMax:
               parsed.data.value_max,
            status: 'completed',
            confidence: null,
         },
      });

   return res
      .status(StatusCodes.OK)
      .json({
         success: true,
         message:
            'Valuation override saved.',
         data: {
            valuation: {
               id: updated.id,
               value_min:
                  updated.valueMin,
               value_max:
                  updated.valueMax,
               status: updated.status,
            },
         },
      });
}
