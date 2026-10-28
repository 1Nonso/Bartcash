import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
   updateProfileSchema,
   deleteAccountSchema,
} from '../validators/user.validators';
import {
   getProfile,
   updateProfile,
   updateAvatar,
   deleteAccount,
   updatePushToken,
   showPublic,
} from '../controllers/user.controllers';
import { limiter, userLimiter } from '../libs/rateLimiter';

const router = Router();

const upload = multer({
   storage: multer.memoryStorage(),
   limits: {
      fileSize: 5 * 1024 * 1024,
   }, // 5MB
   fileFilter: (_req, file, cb) => {
      const allowed = [
         'image/jpeg',
         'image/png',
      ];
      if (
         !allowed.includes(
            file.mimetype,
         )
      ) {
         return cb(
            new Error(
               'Avatar must be a JPEG or PNG image.',
            ),
         );
      }
      cb(null, true);
   },
});

router.get(
   '/profile',
   requireAuth,
   getProfile,
);
router.put(
   '/profile',
   requireAuth,
   validate(updateProfileSchema),
   updateProfile,
);
router.post(
   '/avatar',
   requireAuth,
   limiter,
   upload.single('avatar'),
   updateAvatar,
);
router.delete(
   '/',
   requireAuth,
   validate(deleteAccountSchema),
   deleteAccount,
);
router.patch(
   '/push-token',
   requireAuth,
   updatePushToken,
);

/** Mounted at /api: GET /users/:id (another user's public profile). */
export const publicUserRouter = Router();
publicUserRouter.get(
   '/users/:id',
   requireAuth,
   userLimiter(60),
   showPublic,
);

export default router;
