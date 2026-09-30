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
} from '../controllers/user.controllers';

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

export default router;
