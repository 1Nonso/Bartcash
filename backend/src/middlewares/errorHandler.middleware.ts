import type {
   Request,
   Response,
   NextFunction,
} from 'express';

export function errorHandler(
   err: Error,
   req: Request,
   res: Response,
   next: NextFunction,
) {
   console.error(err);

   return res.status(500).json({
      success: false,
      message:
         process.env.NODE_ENV ===
         'production'
            ? 'Something went wrong. Please try again later.'
            : err.message,
   });
}
