import { auth } from '@/auth';
import { createClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ calls: [], error: 'Unauthorized' }, { status: 401 });

  try {
    const supabase = createClient();
    const { data: user } = await supabase
      .from('users')
      .select('retell_agent_id, role')
      .eq('email', session.user.email)
      .single();

    // super_admin sees all calls; clients are scoped to their own agent
    const agentId = user?.role === 'super_admin' ? null : (user?.retell_agent_id ?? null);

    const body = { limit: 20, sort_order: 'descending' };
    if (agentId) body.filter_criteria = { agent_id: [agentId] };

    const response = await fetch('https://api.retellai.com/v2/list-calls', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RETELL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) throw new Error(`Retell API error: ${response.status}`);
    const data = await response.json();
    return NextResponse.json({ calls: data });
  } catch (error) {
    console.error('[retell/calls GET]', error);
    return NextResponse.json({ calls: [], error: error.message }, { status: 500 });
  }
}
