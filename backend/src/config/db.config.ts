import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

declare global {
   // eslint-disable-next-line no-var
   var __prisma:
      PrismaClient | undefined;
}

// Supabase's free session pooler allows 15 connections in all, and on
// Render the API and the pg-boss worker share one process: Prisma gets 4
// and pg-boss 3 (queue.config.ts), about 8 per instance with pg-boss's
// listener, so even a deploy's brief old/new overlap stays near the limit
// (EMAXCONNSESSION, seen Oct 25 with the default 10 + 10).
export const PRISMA_POOL_MAX = 4;

const adapter = new PrismaPg({
   connectionString:
      process.env.DATABASE_URL,
   max: PRISMA_POOL_MAX,
   idleTimeoutMillis: 30_000,
});

export const db =
   global.__prisma ??
   new PrismaClient({
      adapter,
      log:
         process.env.NODE_ENV ===
         'development'
            ? ['query', 'error', 'warn']
            : // errorHandler logs a safe line; Prisma's own error log
              // can print the values sent (user data).
              [],
   });

if (
   process.env.NODE_ENV !== 'production'
) {
   global.__prisma = db;
}
