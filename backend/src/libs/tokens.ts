import crypto from 'crypto';

// Random 64-byte hex token (matches Laravel's bin2hex(random_bytes(64)) for refresh tokens)
export function generatePlainToken(
   bytes: number,
): string {
   return crypto
      .randomBytes(bytes)
      .toString('hex');
}

export function sha256(
   value: string,
): string {
   return crypto
      .createHash('sha256')
      .update(value)
      .digest('hex');
}

// 6-digit numeric OTP, zero-padded (matches Laravel's str_pad(random_int(0,999999), 6, '0', STR_PAD_LEFT))
export function generateOtp(): string {
   return String(
      crypto.randomInt(0, 1000000),
   ).padStart(6, '0');
}
