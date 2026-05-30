import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = params;
  const supabase = createClient();

  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, name, plan, plan_status, ghl_location_id, ghl_user_id, retell_agent_id, stripe_subscription_id, trial_ends_at, created_at, business_name, business_phone, address, google_review_url')
    .eq('id', id)
    .single();

  if (error || !user) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Fetch recent calls, automations, and missed calls in parallel
  const [callsRes, autoRes, missedRes] = await Promise.all([
    supabase
      .from('retell_calls')
      .select('call_id, call_status, caller_phone_number, start_timestamp, end_timestamp, call_summary')
      .eq('agent_id', user.retell_agent_id || '__none__')
      .order('start_timestamp', { ascending: false })
      .limit(20),
    supabase
      .from('automation_logs')
      .select('id, automation, status, triggered_at')
      .eq('client_id', id)
      .order('triggered_at', { ascending: false })
      .limit(20),
    supabase
      .from('missed_calls')
      .select('id, from_number, timestamp, text_sent')
      .eq('client_id', id)
      .order('timestamp', { ascending: false })
      .limit(10),
  ]);

  return NextResponse.json({
    user,
    calls: callsRes.data || [],
    automations: autoRes.data || [],
    missedCalls: missedRes.data || [],
  });
}

export async function DELETE(request, { params }) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = params;
  const supabase = createClient();

  const { data: target } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', id)
    .single();

  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (target.role === 'super_admin') {
    return NextResponse.json({ error: 'Cannot delete a super admin account.' }, { status: 403 });
  }

  const { error } = await supabase.from('users').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request, { params }) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = params;
  const body = await request.json();

  const VALID_PLANS = ['launch', 'rocket', 'velocity', 'starter', 'growth', 'pro'];
  const allowed = ['ghl_api_key', 'ghl_location_id', 'ghl_user_id', 'retell_agent_id', 'plan', 'plan_status'];
  const updates = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 });
  }

  if (updates.plan !== undefined && !VALID_PLANS.includes(updates.plan)) {
    return NextResponse.json({ error: 'Invalid plan.' }, { status: 400 });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', id)
    .select('id, email, name, plan, plan_status, ghl_location_id, ghl_user_id, retell_agent_id, trial_ends_at, created_at, business_name, business_phone, address, google_review_url')
    .single();
  if (error) return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  return NextResponse.json({ ok: true, user: data });
}
