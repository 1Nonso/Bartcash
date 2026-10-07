import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import * as comments from '../controllers/comment.controllers';
import { limiter } from '../libs/rateLimiter';

const router = Router();

// Mounted at the API root, BEFORE the items router, so the public GET
// isn't caught by any router-level auth on /items.
router.get(
   '/items/:id/comments',
   comments.index,
); // public

router.post(
   '/items/:id/comments',
   requireAuth,
   limiter,
   comments.store,
);

router.delete(
   '/comments/:id',
   requireAuth,
   comments.destroy,
);

export default router;
