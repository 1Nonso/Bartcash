// src/config/r2.config.ts
import { S3Client } from '@aws-sdk/client-s3';

export const r2 = new S3Client({
   region:
      process.env.AWS_DEFAULT_REGION!,
   endpoint: process.env.AWS_ENDPOINT!,
   forcePathStyle:
      process.env
         .AWS_USE_PATH_STYLE_ENDPOINT ===
      'true',
   credentials: {
      accessKeyId:
         process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey:
         process.env
            .AWS_SECRET_ACCESS_KEY!,
   },
});

export const R2_BUCKET =
   process.env.AWS_BUCKET!;
export const R2_PUBLIC_URL =
   process.env.AWS_URL!;
