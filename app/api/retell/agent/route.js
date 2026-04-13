import { auth } from '@/auth';
import { createClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

const AGENCY_AGENT_ID = 'agent_132e809e21c0ff5eb0f006d59e';
const RETELL_BASE = 'https://api.retellai.com/v2';

function retellHeaders() {
  return {
    Authorization: `Bearer ${process.env.RETELL_API_KEY}`,
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

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const agentId = await resolveAgentId(session.user.email);
    const res = await fetch(`${RETELL_BASE}/get-agent/${agentId}`, { headers: retellHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `Retell error: ${res.status}`);
    return NextResponse.json(data);
  } catch (error) {
    console.error('[retell/agent GET]', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const updates = await request.json();
    const agentId = await resolveAgentId(session.user.email);

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
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
