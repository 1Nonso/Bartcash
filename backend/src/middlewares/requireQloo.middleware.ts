import type { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { qlooConfig } from '../config/qloo.config';

/**
 * Phase 4b, Section 16.1: with QLOO_ENABLED=false every Qloo endpoint returns
 * 404 FEATURE_DISABLED. Mount this BEFORE auth on the taste, scout, match and
 * item-taste routers so a disabled feature looks like it does not exist.
 */
export function createRequireQloo(isEnabled: () => boolean) {
   return function requireQloo(_req: Request, res: Response, next: NextFunction) {
      if (isEnabled()) return next();
      return res.status(StatusCodes.NOT_FOUND).json({
         success: false,
         code: 'FEATURE_DISABLED',
         message: 'This feature is not available.',
      });
   };
}

export const requireQloo = createRequireQloo(() => qlooConfig.enabled);
