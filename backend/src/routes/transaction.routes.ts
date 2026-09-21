import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import * as transactions from '../controllers/transaction.controllers';

const router = Router();

router.get(
   '/',
   requireAuth,
   transactions.index,
);
router.get(
   '/:id',
   requireAuth,
   transactions.show,
);

export default router;
