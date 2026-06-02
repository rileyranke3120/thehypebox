import crypto from 'crypto';

// Timing-safe string comparison — prevents timing oracle attacks on secrets.
// Returns false if either argument is missing/empty.
export function safeCompare(a, b) {
  if (!a || !b) return false;
  try {
    const ba = Buffer.from(String(a));
    const bb = Buffer.from(String(b));
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}
