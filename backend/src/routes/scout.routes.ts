import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireQloo } from '../middlewares/requireQloo.middleware';
import { userLimiter } from '../libs/rateLimiter';
import * as scoutController from '../controllers/scout.controllers';

// Scout (Phase 4b, Section 16.7): 10 drafts per user per minute.
const router = Router();

router.post('/draft-offer', requireQloo, requireAuth, userLimiter(10), scoutController.draftOfferHandler);

export default router;
