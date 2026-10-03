// item.routes.ts
import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { runUploadMiddleware } from '../middlewares/upload.middleware';
import * as itemController from '../controllers/item.controllers';
import multer from 'multer';

const upload = multer({
   storage: multer.memoryStorage(),
   limits: {
      fileSize: 10 * 1024 * 1024,
   },
});
const router = Router();

router.post(
   '/',
   requireAuth,
   upload.array('images', 6),
   itemController.create,
);

router.patch(
   '/:id/publish',
   requireAuth,
   itemController.publish,
);

router.post(
   '/:id/images',
   requireAuth,
   runUploadMiddleware,
   itemController.uploadImages,
);
router.get(
   '/',
   requireAuth,
   itemController.index,
);
router.get(
   '/mine',
   requireAuth,
   itemController.mine,
); // must stay above /:id
router.get(
   '/:id',
   requireAuth,
   itemController.show,
);
router.put(
   '/:id',
   requireAuth,
   itemController.update,
);
router.patch(
   '/:id/deactivate',
   requireAuth,
   itemController.deactivate,
);
router.delete(
   '/:id',
   requireAuth,
   itemController.destroy,
);
router.get(
   '/:id/valuation',
   requireAuth,
   itemController.valuation,
);
router.post(
   '/:id/valuation/retry',
   requireAuth,
   itemController.retryValuation,
);
router.patch(
   '/:id/valuation/override',
   requireAuth,
   itemController.overrideValuation,
);

export default router;
