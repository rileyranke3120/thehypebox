import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@/lib/supabase';

const VALID_PLANS = ['launch', 'rocket', 'velocity', 'starter', 'growth', 'pro'];

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = createClient();

  const { data, error } = await supabase
    .from('users')
    .select('id, email, name, business_name, plan, plan_status, ghl_location_id, stripe_customer_id, trial_ends_at, created_at')
    .not('plan_status', 'is', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[admin/clients]', error);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }

  return NextResponse.json({ clients: data || [] });
}

export async function POST(request) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { email, name, plan, business_name } = body;

  if (!email || !name || !plan) {
    return NextResponse.json({ error: 'email, name, and plan are required.' }, { status: 400 });
  }
  if (!VALID_PLANS.includes(plan)) {
    return NextResponse.json({ error: 'Invalid plan.' }, { status: 400 });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('users')
    .insert({
      email: email.trim().toLowerCase(),
      name: name.trim(),
      plan,
      plan_status: 'trialing',
      role: 'client',
      business_name: business_name?.trim() || null,
    })
    .select('id, email, name, business_name, plan, plan_status, created_at')
    .single();

  if (error) return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  return NextResponse.json({ ok: true, user: data }, { status: 201 });
}
