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
   key: string,
   body: Buffer,
   contentType: string,
): Promise<string> {
   await r2.send(
      new PutObjectCommand({
         Bucket: R2_BUCKET,
         Key: key,
         Body: body,
         ContentType: contentType,
      }),
   );

   return `${R2_PUBLIC_URL}/${key}`;
}

export async function deleteFromR2(
   key: string,
): Promise<void> {
   await r2.send(
      new DeleteObjectCommand({
         Bucket: R2_BUCKET,
         Key: key,
      }),
   );
}

/** Items are stored with url = `${R2_PUBLIC_URL}/${key}` (ItemImage has no
 *  separate storage_path column) — derive the key back out when needed. */
export function keyFromPublicUrl(
   url: string,
): string {
   return url.replace(
      `${R2_PUBLIC_URL}/`,
      '',
   );
}
