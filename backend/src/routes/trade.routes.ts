import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import * as tradeController from '../controllers/trade.controllers';

const router = Router();

router.post(
   '/',
   requireAuth,
   tradeController.create,
);
router.get(
   '/',
   requireAuth,
   tradeController.index,
);
router.get(
   '/:id',
   requireAuth,
   tradeController.show,
);
router.post(
   '/:id/rebargain',
   requireAuth,
   tradeController.rebargain,
);
router.patch(
   '/:id/accept',
   requireAuth,
   tradeController.accept,
);
router.patch(
   '/:id/decline',
   requireAuth,
   tradeController.decline,
);
router.patch(
   '/:id/cancel',
   requireAuth,
   tradeController.cancel,
);
router.patch(
   '/:id/complete',
   requireAuth,
   tradeController.complete,
);

export default router;
