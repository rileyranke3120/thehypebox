import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

const VALID_STEPS = [
  'phone_confirmed',
  'sarah_tested',
  'pipeline_checked',
  'google_review_added',
  'onboarding_call_booked',
];

const VALID_STATUSES = ['active', 'trialing'];

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.user.role !== 'super_admin' && !VALID_STATUSES.includes(session.user.plan_status)) {
    return NextResponse.json({ error: 'Subscription required.' }, { status: 402 });
  }

  const { step } = await request.json();
  if (!VALID_STEPS.includes(step)) {
    return NextResponse.json({ error: 'Invalid step' }, { status: 400 });
  }

  const supabase = createClient();

  const { data: user, error: fetchErr } = await supabase
    .from('users')
    .select('id')
    .eq('email', session.user.email)
    .single();

  if (fetchErr || !user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const { error: rpcErr } = await supabase.rpc('set_onboarding_step', {
    p_user_id: user.id,
    p_step: step,
  });

  if (rpcErr) {
    console.error('[checklist] rpc error:', rpcErr);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
