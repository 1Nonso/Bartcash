import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

declare global {
   // eslint-disable-next-line no-var
   var __prisma:
      PrismaClient | undefined;
}

const adapter = new PrismaPg({
   connectionString:
      process.env.DATABASE_URL,
});

export const db =
   global.__prisma ??
   new PrismaClient({
      adapter,
      log:
         process.env.NODE_ENV ===
         'development'
            ? ['query', 'error', 'warn']
            : ['error'],
   });

if (
   process.env.NODE_ENV !== 'production'
) {
   global.__prisma = db;
}
