import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import * as messages from '../controllers/message.controllers';

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
