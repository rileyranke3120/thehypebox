import { auth } from '@/auth';
import { createClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

const VALID_PLANS = ['starter', 'growth', 'pro'];

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
    return NextResponse.json({ ok: true, plan: data?.plan || 'starter' });
  } catch (error) {
    console.error('[billing GET]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const { plan } = await request.json();
    if (!VALID_PLANS.includes(plan)) {
      return NextResponse.json({ ok: false, error: `Invalid plan. Must be one of: ${VALID_PLANS.join(', ')}` }, { status: 400 });
    }

    const supabase = createClient();
    const { error } = await supabase
      .from('users')
      .update({ plan })
      .eq('email', session.user.email);

    if (error) throw error;
    return NextResponse.json({ ok: true, plan });
  } catch (error) {
    console.error('[billing POST]', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
