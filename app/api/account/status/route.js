import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('users')
    .select('plan, plan_status, trial_ends_at')
    .eq('email', session.user.email.toLowerCase())
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({
    plan: data.plan,
    plan_status: data.plan_status,
    trial_ends_at: data.trial_ends_at,
  });
}
