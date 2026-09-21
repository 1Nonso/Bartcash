import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import * as ratings from '../controllers/rating.controllers';

const router = Router();

// Mounted at the API root: /ratings and /users/:id/ratings
router.post(
   '/ratings',
   requireAuth,
   ratings.store,
);
router.get(
   '/users/:id/ratings',
   requireAuth,
   ratings.indexForUser,
);

export default router;
