import {
   PutObjectCommand,
   DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import {
   r2,
   R2_BUCKET,
   R2_PUBLIC_URL,
} from '../config/r2.config';

export async function uploadToR2(
   buffer: Buffer,
   key: string,
   contentType: string,
): Promise<string> {
   await r2.send(
      new PutObjectCommand({
         Bucket: R2_BUCKET,
         Key: key,
         Body: buffer,
         ContentType: contentType,
      }),
   );

   return `${R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
}

export async function deleteFromR2(
   url: string,
): Promise<void> {
   const key = url.replace(
      `${R2_PUBLIC_URL.replace(/\/$/, '')}/`,
      '',
   );

   await r2.send(
      new DeleteObjectCommand({
         Bucket: R2_BUCKET,
         Key: key,
      }),
   );
}
