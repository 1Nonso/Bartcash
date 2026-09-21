import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env
   .JWT_SECRET as string;
if (!JWT_SECRET) {
   throw new Error(
      'JWT_SECRET is not set in the environment.',
   );
}

const ACCESS_TOKEN_TTL_SECONDS =
   parseInt(
      process.env.JWT_ACCESS_TTL ||
         '900',
      10,
   ); // 15 min default

export interface AccessTokenPayload {
   sub: string; // user id
}

export function signAccessToken(
   userId: string,
): string {
   const payload: AccessTokenPayload = {
      sub: userId,
   };
   return jwt.sign(
      payload,
      JWT_SECRET,
      {
         expiresIn:
            ACCESS_TOKEN_TTL_SECONDS,
      },
   );
}

export function verifyAccessToken(
   token: string,
): AccessTokenPayload {
   return jwt.verify(
      token,
      JWT_SECRET,
   ) as AccessTokenPayload;
}
