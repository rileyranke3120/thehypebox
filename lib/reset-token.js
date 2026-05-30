import crypto from 'crypto';

const EXPIRES_IN = 3600; // 1 hour in seconds

// Token format: emailB64.timestamp.nonce.hmac
// The nonce (128 bits from randomBytes) prevents an attacker from forging tokens
// even with knowledge of AUTH_SECRET + approximate request timestamp.
export function generateResetToken(email) {
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(16).toString('hex');
  const secret = process.env.AUTH_SECRET;
  const hmac = crypto
    .createHmac('sha256', secret)
    .update(`${email}:${timestamp}:${nonce}`)
    .digest('hex');
  const emailB64 = Buffer.from(email.toLowerCase()).toString('base64url');
  return `${emailB64}.${timestamp}.${nonce}.${hmac}`;
}

// SHA-256 hash of the full token string — stored in DB to enable invalidation and single-use.
export function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Verify a reset token's HMAC signature and expiry.
 * Returns the email address if the HMAC is valid and the token is not expired.
 * Does NOT check the DB record — callers must do that separately.
 */
export function verifyResetToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 4) return null;

  const [emailB64, timestampStr, nonce, hmac] = parts;
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
    .update(`${email}:${timestamp}:${nonce}`)
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(expected, 'hex'))) {
    return null;
  }

  return email;
}
