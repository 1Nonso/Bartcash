import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import * as messages from '../controllers/message.controllers';
import { limiter } from '../libs/rateLimiter';

const router = Router();

// Mounted at /trades, so these resolve to /trades/:id/messages...
router.get(
   '/:id/messages',
   requireAuth,
   messages.index,
);
router.post(
   '/:id/messages',
   requireAuth,
   limiter,
   messages.store,
);
router.patch(
   '/:id/messages/read',
   requireAuth,
   messages.markRead,
);
router.delete(
   '/:id/messages/:messageId',
   requireAuth,
   messages.destroy,
);

export default router;
