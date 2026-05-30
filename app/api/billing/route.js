import { auth } from '@/auth';
import { createClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

const VALID_PLANS = ['launch', 'rocket', 'velocity', 'starter', 'growth', 'pro'];

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('users')
      .select('plan')
      .eq('email', session.user.email)
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, plan: data?.plan || 'launch' });
  } catch (error) {
    console.error('[billing GET]', error);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'super_admin') {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { plan, email } = await request.json();
    if (!VALID_PLANS.includes(plan)) {
      return NextResponse.json({ ok: false, error: `Invalid plan. Must be one of: ${VALID_PLANS.join(', ')}` }, { status: 400 });
    }
    const targetEmail = email || session.user.email;

    const supabase = createClient();
    const { error } = await supabase
      .from('users')
      .update({ plan })
      .eq('email', targetEmail);

    if (error) throw error;
    return NextResponse.json({ ok: true, plan });
  } catch (error) {
    console.error('[billing POST]', error);
    return NextResponse.json({ ok: false, error: 'Something went wrong.' }, { status: 500 });
  }
}
