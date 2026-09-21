import { Router } from 'express';
import * as authController from '../controllers/auth.controllers';
import { validate } from '../middlewares/validate.middleware';
import { requireAuth } from '../middlewares/auth.middleware';
import {
   registerSchema,
   verifyOtpSchema,
   resendOtpSchema,
   loginSchema,
   refreshTokenSchema,
   logoutSchema,
   forgotPasswordSchema,
   resetPasswordSchema,
} from '../validators/auth.validators';

const router = Router();

router.post(
   '/register',
   validate(registerSchema),
   authController.register,
);
router.post(
   '/verify-otp',
   validate(verifyOtpSchema),
   authController.verifyOtp,
);
router.post(
   '/resend-otp',
   validate(resendOtpSchema),
   authController.resendOtp,
);
router.post(
   '/login',
   validate(loginSchema),
   authController.login,
);
router.post(
   '/refresh',
   validate(refreshTokenSchema),
   authController.refresh,
);
router.post(
   '/logout',
   requireAuth,
   validate(logoutSchema),
   authController.logout,
);
router.post(
   '/forgot-password',
   validate(forgotPasswordSchema),
   authController.forgotPassword,
);
router.post(
   '/reset-password',
   validate(resetPasswordSchema),
   authController.resetPassword,
);

export default router;
