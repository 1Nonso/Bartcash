import type {
   Request,
   Response,
   NextFunction,
} from 'express';
import { verifyAccessToken } from '../libs/jwt';

// Extends Express's Request type so req.userId is available downstream.
declare global {
   namespace Express {
      interface Request {
         userId?: string;
      }
   }
}

export function requireAuth(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   const header =
      req.headers.authorization;

   if (
      !header ||
      !header.startsWith('Bearer ')
   ) {
      return res.status(401).json({
         success: false,
         message:
            'Authentication required.',
      });
   }

   const token = header.slice(
      'Bearer '.length,
   );

   try {
      const payload =
         verifyAccessToken(token);
      req.userId = payload.sub;
      next();
   } catch {
      return res.status(401).json({
         success: false,
         message:
            'Invalid or expired access token.',
      });
   }
}
