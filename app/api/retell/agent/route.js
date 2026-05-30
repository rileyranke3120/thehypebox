import { auth } from '@/auth';
import { createClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

const AGENCY_AGENT_ID = process.env.RETELL_AGENCY_AGENT_ID || null;
const RETELL_PLANS = new Set(['rocket', 'velocity', 'pro', 'growth']);
const RETELL_BASE = 'https://api.retellai.com';

function retellHeaders() {
  const key = process.env.RETELL_API_KEY;
  if (!key) throw new Error('RETELL_API_KEY is not configured');
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}

async function resolveAgentId(email) {
  const supabase = createClient();
  const { data } = await supabase
    .from('users')
    .select('retell_agent_id, role')
    .eq('email', email)
    .single();
  // super_admin always uses the agency agent
  if (!data || data.role === 'super_admin') return AGENCY_AGENT_ID;
  return data.retell_agent_id || AGENCY_AGENT_ID;
}

const VALID_STATUSES = ['active', 'trialing'];

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'super_admin' && !VALID_STATUSES.includes(session.user.plan_status)) {
    return NextResponse.json({ ok: false, error: 'Subscription required.' }, { status: 402 });
  }
  if (session.user.role !== 'super_admin' && !RETELL_PLANS.has(session.user.plan)) {
    return NextResponse.json({ ok: false, error: 'AI phone receptionist requires Rocket Box or higher.' }, { status: 403 });
  }

  try {
    const agentId = await resolveAgentId(session.user.email);
    if (!agentId) return NextResponse.json({ ok: false, error: 'No Retell agent configured' }, { status: 404 });
    const res = await fetch(`${RETELL_BASE}/get-agent/${agentId}`, { headers: retellHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `Retell error: ${res.status}`);
    return NextResponse.json(data);
  } catch (error) {
    console.error('[retell/agent GET]', error);
    return NextResponse.json({ ok: false, error: 'Something went wrong.' }, { status: 500 });
  }
}

const ALLOWED_AGENT_FIELDS = new Set([
  'voice_id',
  'voice_temperature',
  'voice_speed',
  'interruption_sensitivity',
  'responsiveness',
  'end_call_after_silence_ms',
]);

export async function PATCH(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'super_admin' && !VALID_STATUSES.includes(session.user.plan_status)) {
    return NextResponse.json({ ok: false, error: 'Subscription required.' }, { status: 402 });
  }
  if (session.user.role !== 'super_admin' && !RETELL_PLANS.has(session.user.plan)) {
    return NextResponse.json({ ok: false, error: 'AI phone receptionist requires Rocket Box or higher.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const updates = Object.fromEntries(
      Object.entries(body).filter(([k]) => ALLOWED_AGENT_FIELDS.has(k))
    );

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: false, error: 'No valid fields provided.' }, { status: 400 });
    }

    // Never fall back to the agency agent for PATCH — clients must have their own provisioned agent.
    let agentId;
    if (session.user.role === 'super_admin') {
      agentId = AGENCY_AGENT_ID;
    } else {
      const supabase = createClient();
      const { data } = await supabase
        .from('users')
        .select('retell_agent_id')
        .eq('email', session.user.email)
        .single();
      agentId = data?.retell_agent_id || null;
    }

    if (!agentId) {
      return NextResponse.json({ ok: false, error: 'Agent not yet provisioned.' }, { status: 403 });
    }

    const res = await fetch(`${RETELL_BASE}/update-agent/${agentId}`, {
      method: 'PATCH',
      headers: retellHeaders(),
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `Retell error: ${res.status}`);
    return NextResponse.json(data);
  } catch (error) {
    console.error('[retell/agent PATCH]', error);
    return NextResponse.json({ ok: false, error: 'Something went wrong.' }, { status: 500 });
  }
}
