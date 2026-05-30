import crypto from 'crypto';

export function signUnsubscribeId(id) {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) throw new Error('UNSUBSCRIBE_SECRET is not set');
  return crypto.createHmac('sha256', secret).update(String(id)).digest('hex');
}

export function verifyUnsubscribeToken(id, sig) {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(String(id)).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}
