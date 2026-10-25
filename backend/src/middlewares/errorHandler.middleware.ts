import type {
   Request,
   Response,
   NextFunction,
} from 'express';

/** A malformed uuid in a path or query reaches Postgres as 22P02 (Prisma P2007). */
function isInvalidUuid(err: any): boolean {
   return (
      err?.code === 'P2007' &&
      err?.meta?.driverAdapterError?.cause
         ?.originalCode === '22P02'
   );
}

const UUID_IN_PATH = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** Full path without the query string, ids masked (never log user ids). */
function routeOf(req: Request): string {
   return (req.originalUrl ?? '').split('?')[0]!.replace(UUID_IN_PATH, ':id');
}

export function errorHandler(
   err: Error,
   req: Request,
   res: Response,
   next: NextFunction,
) {
   if (isInvalidUuid(err)) {
      return res.status(404).json({
         success: false,
         message: 'Not found.',
      });
   }

   // createHttpError(4xx, message) from a controller keeps its status.
   const status = (err as any)?.status;
   if (
      typeof status === 'number' &&
      status >= 400 &&
      status < 500
   ) {
      return res.status(status).json({
         success: false,
         message: err.message,
      });
   }

   // Never the full error: Prisma messages carry the values sent (user
   // data) and server paths. Route, error name, code and the first line only.
   const code = (err as any)?.code;
   const firstLine = String(err?.message ?? '').split('\n').find((l) => l.trim()) ?? '';
   console.error(
      `error: ${req.method} ${routeOf(req)} ${err?.name ?? 'Error'}${code ? ` code=${code}` : ''} ${firstLine.trim().slice(0, 160)}`,
   );

   return res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again later.',
   });
}
