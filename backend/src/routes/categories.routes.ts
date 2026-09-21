// category.routes.ts
import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import * as categoryController from '../controllers/categories.controllers';

const router = Router();
router.get(
   '/',
   requireAuth,
   categoryController.index,
);
export default router;
