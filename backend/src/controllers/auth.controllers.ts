import type {
   Request,
   Response,
} from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../config/db.config';
import { signAccessToken } from '../libs/jwt';
import {
   generateOtp,
   generatePlainToken,
   sha256,
} from '../libs/tokens';
import {
   sendOtpEmail,
   sendPasswordResetEmail,
} from '../libs/sendLibs';
import * as rateLimiter from '../libs/rateLimiter';
import {
   ReasonPhrases,
   StatusCodes,
} from 'http-status-codes';

const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 3;
const RESEND_OTP_MAX = 3;
const RESEND_OTP_WINDOW_SECONDS =
   30 * 60;
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_SECONDS = 15 * 60;
const FORGOT_PASSWORD_MAX = 3;
const FORGOT_PASSWORD_WINDOW_SECONDS =
   15 * 60;
const REFRESH_TOKEN_TTL_DAYS = 30;
const RESET_TOKEN_TTL_HOURS = 1;

export async function register(
   req: Request,
   res: Response,
) {
   const {
      first_name,
      last_name,
      email,
      password,
   } = req.body;

   const existingUser =
      await db.user.findUnique({
         where: { email: email },
      });

   if (existingUser) {
      return res
         .status(StatusCodes.CONFLICT)
         .json({
            success: false,
            message:
               ReasonPhrases.CONFLICT,
            description:
               'Email address is already registered.',
            errors: {
               email: [
                  'An account with this email already exists.',
               ],
            },
         });
   }

   const passwordHash =
      await bcrypt.hash(password, 10);

   const user = await db.user.create({
      data: {
         firstName: first_name,
         lastName: last_name,
         email,
         password: passwordHash,
         isActive: true,
      },
   });

   const otp = generateOtp();
   const codeHash = await bcrypt.hash(
      otp,
      10,
   );

   await db.otpCode.deleteMany({
      where: { email: user.email },
   });

   await db.otpCode.create({
      data: {
         email: user.email,
         codeHash,
         attempts: 0,
         expiresAt: new Date(
            Date.now() +
               OTP_TTL_MINUTES *
                  60 *
                  1000,
         ),
      },
   });

   await sendOtpEmail(
      user.email,
      otp,
      user.firstName,
   );

   return res
      .status(StatusCodes.CREATED)
      .json({
         success: true,
         message: ReasonPhrases.CREATED,
         description:
            'Account created. Please verify your email.',
         data: {
            user_id: user.id,
            email: user.email,
         },
      });
}

export async function verifyOtp(
   req: Request,
   res: Response,
) {
   const { email, otp } = req.body;

   if (!email) {
      return res
         .status(
            StatusCodes.BAD_REQUEST,
         )
         .json({
            success: false,
            message:
               ReasonPhrases.BAD_REQUEST,
            description:
               'Missing Field',
         });
   }

   if (!otp) {
      return res
         .status(
            StatusCodes.BAD_REQUEST,
         )
         .json({
            success: false,
            message:
               ReasonPhrases.BAD_REQUEST,
            description:
               'Missing Field',
         });
   }

   const otpRecord =
      await db.otpCode.findFirst({
         where: {
            email,
            expiresAt: {
               gt: new Date(),
            },
         },
         orderBy: { createdAt: 'desc' },
      });

   if (!otpRecord) {
      return res.status(400).json({
         success: false,
         message:
            'OTP has expired or does not exist. Please request a new one.',
         errors: {
            otp: [
               'Code has expired or is invalid.',
            ],
         },
      });
   }

   if (
      otpRecord.attempts >=
      OTP_MAX_ATTEMPTS
   ) {
      await db.otpCode.delete({
         where: { id: otpRecord.id },
      });
      return res
         .status(
            StatusCodes.TOO_MANY_REQUESTS,
         )
         .json({
            success: false,
            message:
               ReasonPhrases.TOO_MANY_REQUESTS,
            description:
               'Too many incorrect attempts. Please request a new code.',
            errors: {
               otp: [
                  'Maximum attempts exceeded.',
               ],
            },
         });
   }

   const matches = await bcrypt.compare(
      otp,
      otpRecord.codeHash,
   );
   if (!matches) {
      await db.otpCode.update({
         where: { id: otpRecord.id },
         data: {
            attempts:
               otpRecord.attempts + 1,
         },
      });
      return res
         .status(
            StatusCodes.BAD_REQUEST,
         )
         .json({
            success: false,
            message:
               ReasonPhrases.BAD_REQUEST,
            description:
               'Incorrect code. Please try again.',
            errors: {
               otp: [
                  'The code you entered is incorrect.',
               ],
            },
         });
   }

   const user =
      await db.user.findUnique({
         where: { email: email },
      });

   if (!user) {
      return res
         .status(StatusCodes.NOT_FOUND)
         .json({
            success: false,
            message: 'User not found.',
         });
   }

   await db.user.update({
      where: { email: email },
      data: {
         emailVerifiedAt: new Date(
            Date.now(),
         ),
      },
   });

   await db.otpCode.delete({
      where: { id: otpRecord.id },
   });

   return res
      .status(StatusCodes.OK)
      .json({
         success: true,
         message: ReasonPhrases.OK,
         description:
            'Email verified. You may now log in.',
      });
}

export async function resendOtp(
   req: Request,
   res: Response,
) {
   const { email } = req.body;

   if (!email) {
      return res
         .status(StatusCodes.NOT_FOUND)
         .json({
            success: false,
            message:
               ReasonPhrases.NOT_FOUND,
            description:
               'Missing Field',
         });
   }

   const user =
      await db.user.findUnique({
         where: { email: email },
      });

   if (!user) {
      return res
         .status(StatusCodes.OK)
         .json({
            success: true,
            message: ReasonPhrases.OK,
            description:
               'If an unverified account exists with this email, a new code has been sent.',
         });
   }

   if (user.emailVerifiedAt) {
      return res
         .status(
            StatusCodes.BAD_REQUEST,
         )
         .json({
            success: false,
            message:
               ReasonPhrases.BAD_REQUEST,
            description:
               'This email address is already verified.',
            errors: {
               email: [
                  'Account is already verified.',
               ],
            },
         });
   }

   const rateLimitKey = `resend-otp-limit:${email}`;
   if (
      await rateLimiter.tooManyAttempts(
         rateLimitKey,
         RESEND_OTP_MAX,
      )
   ) {
      return res
         .status(
            StatusCodes.TOO_MANY_REQUESTS,
         )
         .json({
            success: false,
            message:
               ReasonPhrases.TOO_MANY_REQUESTS,
            description:
               'Too many requests. Please try again in 30 minutes.',
            errors: {
               email: [
                  'Rate limit exceeded.',
               ],
            },
         });
   }
   await rateLimiter.hit(
      rateLimitKey,
      RESEND_OTP_WINDOW_SECONDS,
   );

   const otp = generateOtp();
   const codeHash = await bcrypt.hash(
      otp,
      10,
   );

   await db.otpCode.deleteMany({
      where: { email: user.email },
   });

   await db.otpCode.create({
      data: {
         email: user.email,
         codeHash,
         attempts: 0,
         expiresAt: new Date(
            Date.now() +
               OTP_TTL_MINUTES *
                  60 *
                  1000,
         ),
      },
   });

   await sendOtpEmail(
      user.email,
      otp,
      user.firstName,
   );

   return res
      .status(StatusCodes.OK)
      .json({
         success: true,
         message: ReasonPhrases.OK,
         description:
            'If an unverified account exists with this email, a new code has been sent.',
      });
}

export async function login(
   req: Request,
   res: Response,
) {
   const { email, password } = req.body;

   if (!email || !password) {
      return res
         .status(
            StatusCodes.BAD_REQUEST,
         )
         .json({
            success: false,
            message:
               ReasonPhrases.BAD_REQUEST,
            description:
               'Missing Field',
         });
   }

   const rateLimitKey = `login:${email}`;

   if (
      await rateLimiter.tooManyAttempts(
         rateLimitKey,
         LOGIN_MAX_ATTEMPTS,
      )
   ) {
      const seconds =
         await rateLimiter.availableInSeconds(
            rateLimitKey,
         );
      return res
         .status(
            StatusCodes.TOO_MANY_REQUESTS,
         )
         .json({
            success: false,
            message:
               ReasonPhrases.TOO_MANY_REQUESTS,
            description: `Too many failed attempts. Please try again in ${Math.ceil(seconds / 60)} minutes.`,
         });
   }

   const user =
      await db.user.findUnique({
         where: { email: email },
      });

   const passwordMatches = user
      ? await bcrypt.compare(
           password,
           user.password,
        )
      : false;

   if (!user || !passwordMatches) {
      await rateLimiter.hit(
         rateLimitKey,
         LOGIN_WINDOW_SECONDS,
      );
      return res
         .status(
            StatusCodes.UNAUTHORIZED,
         )
         .json({
            success: false,
            message:
               ReasonPhrases.UNAUTHORIZED,
            description:
               'Invalid email or password.',
            errors: {
               credentials: [
                  'The provided credentials are incorrect.',
               ],
            },
         });
   }

   if (!user.isActive) {
      return res.status(403).json({
         success: false,
         message:
            'Your account has been deactivated. Please contact support.',
      });
   }

   if (!user.emailVerifiedAt) {
      return res.status(403).json({
         success: false,
         message:
            'Please verify your email before logging in.',
         errors: {
            email: [
               'Email address is not verified.',
            ],
         },
      });
   }

   await rateLimiter.clear(
      rateLimitKey,
   );

   const accessToken = signAccessToken(
      user.id,
   );
   const plainRefreshToken =
      generatePlainToken(64);

   await db.refreshToken.create({
      data: {
         userId: user.id,
         token: sha256(
            plainRefreshToken,
         ),
         expiresAt: new Date(
            Date.now() +
               REFRESH_TOKEN_TTL_DAYS *
                  24 *
                  60 *
                  60 *
                  1000,
         ),
         revoked: false,
         ipAddress: req.ip as string,
         userAgent:
            (req.get(
               'user-agent',
            ) as any) || undefined,
      },
   });

   return res
      .status(StatusCodes.OK)
      .json({
         success: true,
         message: ReasonPhrases.OK,
         description:
            'Login successful.',
         data: {
            access_token: accessToken,
            refresh_token:
               plainRefreshToken,
            user: {
               id: user.id,
               first_name:
                  user.firstName,
               last_name: user.lastName,
               email: user.email,
               profile_photo:
                  user.profilePhoto,
               average_rating:
                  user.averageRating,
            },
         },
      });
}

export async function refresh(
   req: Request,
   res: Response,
) {
   const { refresh_token } = req.body;

   if (!refresh_token) {
      return res
         .status(
            StatusCodes.BAD_REQUEST,
         )
         .json({
            success: false,
            message:
               ReasonPhrases.BAD_REQUEST,
            description:
               'Missing Field',
         });
   }

   const hashedToken = sha256(
      refresh_token,
   );

   const tokenRecord =
      await db.refreshToken.findFirst({
         where: {
            token: hashedToken,
            revoked: false,
            expiresAt: {
               gt: new Date(),
            },
         },
      });

   if (!tokenRecord) {
      return res
         .status(
            StatusCodes.UNAUTHORIZED,
         )
         .json({
            success: false,
            message:
               ReasonPhrases.UNAUTHORIZED,
            description:
               'Invalid or expired refresh token. Please log in again.',
         });
   }

   const user =
      await db.user.findUnique({
         where: {
            id: tokenRecord.userId,
         },
      });

   if (!user || !user.isActive) {
      return res
         .status(
            StatusCodes.UNAUTHORIZED,
         )
         .json({
            success: false,
            message:
               ReasonPhrases.UNAUTHORIZED,
            description:
               'User not found or account is inactive.',
         });
   }

   await db.refreshToken.update({
      where: { id: tokenRecord.id },
      data: {
         revoked: true,
         revokedAt: new Date(
            Date.now(),
         ),
      },
   });

   const newAccessToken =
      signAccessToken(user.id);
   const newPlainRefreshToken =
      generatePlainToken(64);

   await db.refreshToken.create({
      data: {
         userId: user.id,
         token: sha256(
            newPlainRefreshToken,
         ),
         expiresAt: new Date(
            Date.now() +
               REFRESH_TOKEN_TTL_DAYS *
                  24 *
                  60 *
                  60 *
                  1000,
         ),
         revoked: false,
         ipAddress: req.ip as string,
         userAgent:
            (req.get(
               'user-agent',
            ) as any) || undefined,
      },
   });

   return res
      .status(StatusCodes.OK)
      .json({
         success: true,
         message: ReasonPhrases.OK,
         description:
            'Tokens refreshed.',
         data: {
            access_token:
               newAccessToken,
            refresh_token:
               newPlainRefreshToken,
         },
      });
}

export async function logout(
   req: Request,
   res: Response,
) {
   const { refresh_token } = req.body;

   if (!refresh_token) {
      return res
         .status(
            StatusCodes.BAD_REQUEST,
         )
         .json({
            success: false,
            message:
               ReasonPhrases.BAD_REQUEST,
            description:
               'Missing Field',
         });
   }

   const hashedToken = sha256(
      refresh_token,
   );

   const tokenRecord =
      await db.refreshToken.findFirst({
         where: {
            token: hashedToken,
            userId:
               req.userId as string,
         },
      });

   if (tokenRecord) {
      await db.refreshToken.update({
         where: { id: tokenRecord.id },
         data: {
            revoked: true,
            revokedAt: new Date(
               Date.now(),
            ),
         },
      });
   }

   return res
      .status(StatusCodes.OK)
      .json({
         success: true,
         message: ReasonPhrases.OK,
         description:
            'Logged out successfully.',
      });
}

export async function forgotPassword(
   req: Request,
   res: Response,
) {
   const { email } = req.body;

   if (!email) {
      return res
         .status(
            StatusCodes.BAD_REQUEST,
         )
         .json({
            success: false,
            message:
               ReasonPhrases.BAD_REQUEST,
            description:
               'Missing Field',
         });
   }

   const rateLimitKey = `forgot-password:${email}`;

   if (
      await rateLimiter.tooManyAttempts(
         rateLimitKey,
         FORGOT_PASSWORD_MAX,
      )
   ) {
      const seconds =
         await rateLimiter.availableInSeconds(
            rateLimitKey,
         );
      return res
         .status(
            StatusCodes.TOO_MANY_REQUESTS,
         )
         .json({
            success: false,
            message:
               ReasonPhrases.TOO_MANY_REQUESTS,
            description: `Too many requests. Please try again in ${Math.ceil(seconds / 60)} minutes.`,
         });
   }
   await rateLimiter.hit(
      rateLimitKey,
      FORGOT_PASSWORD_WINDOW_SECONDS,
   );

   const user =
      await db.user.findUnique({
         where: { email: email },
      });

   if (!user) {
      return res.status(200).json({
         success: true,
         message:
            'If an account exists with this email, a reset link has been sent.',
      });
   }

   await db.passwordResetToken.updateMany(
      {
         where: {
            userId: user.id,
            used: false,
         },
         data: {
            used: true,
            usedAt: new Date(
               Date.now(),
            ),
         },
      },
   );

   const plainToken =
      generatePlainToken(32);

   await db.passwordResetToken.create({
      data: {
         userId: user.id,
         token: sha256(plainToken),
         expiresAt: new Date(
            Date.now() +
               RESET_TOKEN_TTL_HOURS *
                  60 *
                  60 *
                  1000,
         ),
         used: false,
      },
   });

   const resetLink = `${process.env.API_BASE_URL}/reset-password-redirect?token=${plainToken}`;
   await sendPasswordResetEmail(
      user.email,
      resetLink,
      user.firstName,
   );

   return res
      .status(StatusCodes.OK)
      .json({
         success: true,
         message: ReasonPhrases.OK,
         description:
            'If an account exists with this email, a reset link has been sent.',
      });
}

export async function resetPassword(
   req: Request,
   res: Response,
) {
   const { token, password } = req.body;

   if (!token || !password) {
      return res
         .status(
            StatusCodes.BAD_REQUEST,
         )
         .json({
            success: false,
            message:
               ReasonPhrases.BAD_REQUEST,
            description:
               'Missing Field',
         });
   }

   const hashedToken = sha256(token);

   const tokenRecord =
      await db.passwordResetToken.findFirst(
         {
            where: {
               token: hashedToken,
               used: false,
               expiresAt: {
                  gt: new Date(),
               },
            },
         },
      );

   if (!tokenRecord) {
      return res
         .status(
            StatusCodes.BAD_REQUEST,
         )
         .json({
            success: false,
            message:
               ReasonPhrases.BAD_REQUEST,
            description:
               'This reset link is invalid or has expired. Please request a new one.',
         });
   }

   const user =
      await db.user.findUnique({
         where: {
            id: tokenRecord.userId,
         },
      });

   if (!user) {
      return res
         .status(StatusCodes.NOT_FOUND)
         .json({
            success: false,
            message:
               ReasonPhrases.NOT_FOUND,
            description:
               'User not found.',
         });
   }

   const passwordHash =
      await bcrypt.hash(password, 10);

   await db.user.update({
      where: { id: user.id },
      data: {
         password: passwordHash,
      },
   });

   await db.passwordResetToken.update({
      where: { id: tokenRecord.id },
      data: {
         used: true,
         usedAt: new Date(Date.now()),
      },
   });

   await db.refreshToken.updateMany({
      where: {
         userId: user.id,
         revoked: false,
      },
      data: {
         revoked: true,
         revokedAt: new Date(
            Date.now(),
         ),
      },
   });

   return res
      .status(StatusCodes.OK)
      .json({
         success: true,
         message: ReasonPhrases.OK,
         description:
            'Password reset successfully. Please log in with your new password.',
      });
}

export async function resetPasswordRedirect(
   req: Request,
   res: Response,
) {
   const token = req.query
      .token as string;
   const appLink = `bartcash://reset-password?token=${encodeURIComponent(token ?? '')}`;

   res.set('Content-Type', 'text/html')
      .send(`
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8" /></head>
        <body style="font-family: sans-serif; text-align:center; padding-top: 60px;">
          <p>Opening Bartcash…</p>
          <p>If nothing happens, <a href="${appLink}">tap here to open the app</a>.</p>
          <script>
            window.location.href = ${JSON.stringify(appLink)};
          </script>
        </body>
      </html>
   `);
}
