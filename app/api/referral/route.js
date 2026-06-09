import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient();

  const { data: user, error } = await supabase
    .from('users')
    .select('id, referral_code, referral_credits_cents')
    .eq('email', session.user.email.toLowerCase())
    .single();

  if (error || !user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const { data: referrals } = await supabase
    .from('referral_tracking')
    .select('referred_email, credit_cents, stripe_credit_applied, created_at')
    .eq('referrer_user_id', user.id)
    .order('created_at', { ascending: false });

  return NextResponse.json({
    referralCode: user.referral_code,
    totalCreditsCents: user.referral_credits_cents,
    referrals: referrals || [],
  });
}
