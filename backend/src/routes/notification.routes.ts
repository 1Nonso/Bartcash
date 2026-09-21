import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import * as notifications from '../controllers/notification.controllers';

const router = Router();

router.get(
   '/',
   requireAuth,
   notifications.index,
);
router.patch(
   '/read-all',
   requireAuth,
   notifications.markAllRead,
);
router.patch(
   '/:id/read',
   requireAuth,
   notifications.markRead,
);
router.delete(
   '/:id',
   requireAuth,
   notifications.destroy,
);

export default router;
