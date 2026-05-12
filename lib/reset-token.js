import crypto from 'crypto';

const EXPIRES_IN = 3600; // 1 hour in seconds

export function generateResetToken(email) {
  const timestamp = Math.floor(Date.now() / 1000);
  const secret = process.env.AUTH_SECRET;
  const hmac = crypto
    .createHmac('sha256', secret)
    .update(`${email}:${timestamp}`)
    .digest('hex');
  const emailB64 = Buffer.from(email.toLowerCase()).toString('base64url');
  return `${emailB64}.${timestamp}.${hmac}`;
}

/**
 * Verify a reset token.
 * Returns the email address if valid, or null if expired/tampered.
 */
export function verifyResetToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [emailB64, timestampStr, hmac] = parts;
  let email;
  try {
    email = Buffer.from(emailB64, 'base64url').toString();
  } catch {
    return null;
  }

  const timestamp = parseInt(timestampStr, 10);
  if (!Number.isInteger(timestamp)) return null;

  // Check expiry
  if (Math.floor(Date.now() / 1000) - timestamp > EXPIRES_IN) return null;

  // Verify HMAC
  const secret = process.env.AUTH_SECRET;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${email}:${timestamp}`)
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(expected, 'hex'))) {
    return null;
  }

  return email;
}
