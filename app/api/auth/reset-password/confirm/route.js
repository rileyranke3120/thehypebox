import crypto from 'crypto';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createClient } from '@/lib/supabase';
import { verifyResetToken, hashResetToken } from '@/lib/reset-token';

export async function POST(request) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json({ error: 'Token and password are required.' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }
    if (!/[A-Z]/.test(password)) {
      return NextResponse.json({ error: 'Password must contain at least one uppercase letter.' }, { status: 400 });
    }
    if (!/[0-9]/.test(password)) {
      return NextResponse.json({ error: 'Password must contain at least one number.' }, { status: 400 });
    }

    // Step 1: verify HMAC signature and expiry
    const email = verifyResetToken(token);
    if (!email) {
      return NextResponse.json({ error: 'This reset link is invalid or has expired. Please request a new one.' }, { status: 400 });
    }

    // Step 2: verify the token hash matches the one stored in DB (single-use + invalidation)
    const supabase = createClient();
    const { data: user } = await supabase
      .from('users')
      .select('reset_token_hash, reset_token_expires_at')
      .eq('email', email)
      .single();

    const tokenHash = hashResetToken(token);
    const storedHash = user?.reset_token_hash;
    const expiresAt = user?.reset_token_expires_at;

    let hashesMatch = false;
    try {
      hashesMatch = !!(storedHash && crypto.timingSafeEqual(
        Buffer.from(tokenHash, 'hex'),
        Buffer.from(storedHash, 'hex')
      ));
    } catch {
      hashesMatch = false;
    }
    if (!hashesMatch) {
      return NextResponse.json({ error: 'This reset link is invalid or has already been used. Please request a new one.' }, { status: 400 });
    }

    if (!expiresAt || new Date(expiresAt) < new Date()) {
      return NextResponse.json({ error: 'This reset link has expired. Please request a new one.' }, { status: 400 });
    }

    const password_hash = await bcrypt.hash(password, 12);

    // Step 3: update password and clear the token in one atomic update.
    // Clearing reset_token_hash prevents the same link from being used again.
    const { error } = await supabase
      .from('users')
      .update({ password_hash, reset_token_hash: null, reset_token_expires_at: null })
      .eq('email', email);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[reset-password/confirm]', err);
    return NextResponse.json({ error: 'Failed to reset password. Please try again.' }, { status: 500 });
  }
}
