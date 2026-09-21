import { z } from 'zod';

const passwordRule = z
   .string()
   .min(
      8,
      'The password must be at least 8 characters.',
   )
   .regex(
      /^(?=.*[a-zA-Z])(?=.*[0-9]).+$/,
      'Password must contain at least one letter and one number.',
   );

export const registerSchema = z
   .object({
      first_name: z.string().max(100),
      last_name: z.string().max(100),
      email: z
         .string()
         .email()
         .max(255),
      password: passwordRule,
      password_confirmation: z.string(),
   })
   .refine(
      (data) =>
         data.password ===
         data.password_confirmation,
      {
         message:
            'The password confirmation does not match.',
         path: ['password'],
      },
   );

export const verifyOtpSchema = z.object(
   {
      email: z.string().email(),
      otp: z.string().length(6),
   },
);

export const resendOtpSchema = z.object(
   {
      email: z.string().email(),
   },
);

export const loginSchema = z.object({
   email: z.string().email(),
   password: z.string(),
});

export const refreshTokenSchema =
   z.object({
      refresh_token: z.string(),
   });

export const logoutSchema = z.object({
   refresh_token: z.string(),
});

export const forgotPasswordSchema =
   z.object({
      email: z.string().email(),
   });

export const resetPasswordSchema = z
   .object({
      token: z.string(),
      password: passwordRule,
      password_confirmation: z.string(),
   })
   .refine(
      (data) =>
         data.password ===
         data.password_confirmation,
      {
         message:
            'The password confirmation does not match.',
         path: ['password'],
      },
   );
