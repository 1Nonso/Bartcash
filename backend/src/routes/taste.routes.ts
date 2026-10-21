import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireQloo } from '../middlewares/requireQloo.middleware';
import { userLimiter } from '../libs/rateLimiter';
import * as tasteController from '../controllers/taste.controllers';

// Taste profile (Phase 4b, Section 16.4). requireQloo runs before auth so a
// disabled feature looks like it does not exist.
const router = Router();

router.get('/search', requireQloo, requireAuth, userLimiter(30), tasteController.search);
router.get('/suggestions', requireQloo, requireAuth, userLimiter(30), tasteController.suggestions);
router.get('/profile', requireQloo, requireAuth, userLimiter(60), tasteController.profile);
router.put('/profile', requireQloo, requireAuth, userLimiter(60), tasteController.replace);
router.get('/compatible-users', requireQloo, requireAuth, userLimiter(60), tasteController.compatibleUsers);

/** Mounted at /api: GET /users/:id/taste-compatibility (API §16.4). */
export const userTasteRouter = Router();
userTasteRouter.get(
   '/users/:id/taste-compatibility',
   requireQloo,
   requireAuth,
   userLimiter(60),
   tasteController.pairCompatibility,
);

export default router;
