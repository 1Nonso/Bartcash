import type {
   Request,
   Response,
   NextFunction,
} from 'express';
import type {
   ZodError,
   ZodSchema,
} from 'zod';

// Formats Zod errors as { field: [messages] }, matching Laravel's
// $validator->errors() shape used throughout AuthController.
function formatZodErrors(
   error: ZodError,
): Record<string, string[]> {
   const errors: Record<
      string,
      string[]
   > = {};
   for (const issue of error.issues) {
      const field =
         issue.path.join('.') || '_';
      if (!errors[field])
         errors[field] = [];
      errors[field].push(issue.message);
   }
   return errors;
}

export function validate(
   schema: ZodSchema,
) {
   return (
      req: Request,
      res: Response,
      next: NextFunction,
   ) => {
      const result = schema.safeParse(
         req.body,
      );

      if (!result.success) {
         return res.status(400).json({
            success: false,
            message:
               'Validation failed.',
            errors: formatZodErrors(
               result.error,
            ),
         });
      }

      req.body = result.data;
      next();
   };
}
