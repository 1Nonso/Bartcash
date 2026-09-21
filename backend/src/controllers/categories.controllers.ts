import type {
   Request,
   Response,
} from 'express';
import { db } from '../config/db.config';
import {
   ReasonPhrases,
   StatusCodes,
} from 'http-status-codes';

export async function index(
   _req: Request,
   res: Response,
) {
   const categories =
      await db.category.findMany({
         where: { isActive: true },
         orderBy: { name: 'asc' },
         select: {
            id: true,
            name: true,
            slug: true,
            icon: true,
         },
      });

   return res
      .status(StatusCodes.OK)
      .json({
         success: true,
         message: ReasonPhrases.OK,
         data: { categories },
      });
}
