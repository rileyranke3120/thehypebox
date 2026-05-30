import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { auth } from '@/auth';
import { createClient } from '@/lib/supabase';

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { currentPassword, newPassword } = await request.json();

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Both current and new password are required.' }, { status: 400 });
  }

  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'New password must be at least 8 characters.' }, { status: 400 });
  }
  if (!/[A-Z]/.test(newPassword)) {
    return NextResponse.json({ error: 'New password must contain at least one uppercase letter.' }, { status: 400 });
  }
  if (!/[0-9]/.test(newPassword)) {
    return NextResponse.json({ error: 'New password must contain at least one number.' }, { status: 400 });
  }

  if (currentPassword === newPassword) {
    return NextResponse.json({ error: 'New password must be different from current password.' }, { status: 400 });
  }

  const supabase = createClient();
  const { data: user } = await supabase
    .from('users')
    .select('password_hash')
    .eq('email', session.user.email.toLowerCase())
    .single();

  if (!user?.password_hash) {
    return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
  }

  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) {
    return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 });
  }

  const password_hash = await bcrypt.hash(newPassword, 12);
  const { error } = await supabase
    .from('users')
    .update({ password_hash })
    .eq('email', session.user.email.toLowerCase());

  if (error) {
    return NextResponse.json({ error: 'Failed to update password.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
