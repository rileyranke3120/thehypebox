import { auth } from '@/auth';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const user = session.user ?? {};
    const isSuperAdmin = user.role === 'super_admin';
    // Fetch Retell calls (all agents / all clients for super_admin)
    const retellRes = await fetch('https://api.retellai.com/v2/list-calls', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RETELL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ limit: 50 }),
    });
    const retellData = retellRes.ok ? await retellRes.json() : [];
    const retellCalls = (Array.isArray(retellData) ? retellData : retellData?.calls ?? []).map((c) => ({
      id: c.call_id,
      source: 'retell',
      from: c.from_number || c.caller_number || '—',
      to: c.to_number || c.agent_number || '—',
      status: c.call_status || c.status || '—',
      startedAt: c.start_timestamp ? new Date(c.start_timestamp).toISOString() : null,
      durationSeconds: c.start_timestamp && c.end_timestamp
        ? Math.round((c.end_timestamp - c.start_timestamp) / 1000)
        : null,
      summary: c.call_analysis?.call_summary || null,
      disconnectReason: c.disconnection_reason || null,
      textSent: false,
    }));

    // Fetch missed calls from Supabase
    let missedQuery = supabase
      .from('missed_calls')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(50);
    if (!isSuperAdmin) missedQuery = missedQuery.eq('client_id', user.id);
    const { data: missedCalls = [] } = await missedQuery;

    const supabaseCalls = missedCalls.map((c) => ({
      id: c.id,
      source: 'missed',
      from: c.from_number || '—',
      to: '—',
      status: 'missed',
      startedAt: c.timestamp || null,
      durationSeconds: null,
      summary: null,
      disconnectReason: null,
      textSent: c.text_sent ?? false,
      retellCallId: c.call_id,
    }));

    // Merge: enrich missed calls with Retell data where call_id matches
    const retellById = Object.fromEntries(retellCalls.map((c) => [c.id, c]));
    const enrichedMissed = supabaseCalls.map((m) => {
      if (m.retellCallId && retellById[m.retellCallId]) {
        const r = retellById[m.retellCallId];
        return { ...m, durationSeconds: r.durationSeconds, summary: r.summary };
      }
      return m;
    });

    // Combine and sort newest first (de-dupe Retell calls that are also in missed_calls)
    const missedRetellIds = new Set(supabaseCalls.map((c) => c.retellCallId).filter(Boolean));
    const uniqueRetell = retellCalls.filter((c) => !missedRetellIds.has(c.id));
    const all = [...enrichedMissed, ...uniqueRetell].sort((a, b) => {
      const ta = a.startedAt ? new Date(a.startedAt).getTime() : 0;
      const tb = b.startedAt ? new Date(b.startedAt).getTime() : 0;
      return tb - ta;
    });

    return NextResponse.json({ calls: all });
  } catch (err) {
    console.error('Calls log API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
