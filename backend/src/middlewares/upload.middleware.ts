import multer from 'multer';
import type {
   Request,
   Response,
   NextFunction,
} from 'express';
import {
   ReasonPhrases,
   StatusCodes,
} from 'http-status-codes';

const ALLOWED_MIME_TYPES = [
   'image/jpeg',
   'image/jpg',
   'image/png',
];

const uploadItemImages = multer({
   storage: multer.memoryStorage(),
   limits: {
      fileSize: 5 * 1024 * 1024,
      files: 6,
   },
   fileFilter: (_req, file, cb) => {
      if (
         !ALLOWED_MIME_TYPES.includes(
            file.mimetype,
         )
      ) {
         return cb(
            new Error(
               'Images must be JPEG or PNG format.',
            ),
         );
      }
      cb(null, true);
   },
}).array('images', 6);

export function runUploadMiddleware(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   uploadItemImages(
      req,
      res,
      (err: unknown) => {
         if (!err) return next();

         const message =
            err instanceof
               multer.MulterError &&
            err.code ===
               'LIMIT_FILE_SIZE'
               ? 'Each image may not exceed 5MB.'
               : err instanceof
                      multer.MulterError &&
                   err.code ===
                      'LIMIT_FILE_COUNT'
                 ? 'You may upload a maximum of 6 images at once.'
                 : err instanceof
                        multer.MulterError &&
                     err.code ===
                        'LIMIT_UNEXPECTED_FILE'
                   ? `Unexpected field. Upload files using the field name "images".`
                   : (err as Error)
                        .message;

         return res
            .status(
               StatusCodes.BAD_REQUEST,
            )
            .json({
               success: false,
               message:
                  ReasonPhrases.BAD_REQUEST,
               description: message,
            });
      },
   );
}
