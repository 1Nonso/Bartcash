import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import * as disputes from '../controllers/dispute.controllers';

const router = Router();

router.post(
   '/',
   requireAuth,
   disputes.store,
);
router.get(
   '/:id',
   requireAuth,
   disputes.show,
);

export default router;
