import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createClient } from '@/lib/supabase';
import { verifyResetToken } from '@/lib/reset-token';

export async function POST(request) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json({ error: 'Token and password are required.' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    const email = verifyResetToken(token);
    if (!email) {
      return NextResponse.json({ error: 'This reset link is invalid or has expired. Please request a new one.' }, { status: 400 });
    }

    const password_hash = await bcrypt.hash(password, 12);

    const supabase = createClient();
    const { error } = await supabase
      .from('users')
      .update({ password_hash })
      .eq('email', email);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[reset-password/confirm]', err);
    return NextResponse.json({ error: 'Failed to reset password. Please try again.' }, { status: 500 });
  }
}
