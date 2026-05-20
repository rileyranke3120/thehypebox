import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get('days') || '30');

  const supabase = createClient();
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const { data: calls, error } = await supabase
    .from('retell_calls')
    .select('call_id, agent_id, call_status, caller_phone_number, start_timestamp, end_timestamp, call_summary, transcript')
    .gte('created_at', since)
    .order('start_timestamp', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich with client names from users table
  const agentIds = [...new Set((calls || []).map(c => c.agent_id).filter(Boolean))];
  let agentMap = {};

  if (agentIds.length) {
    const { data: users } = await supabase
      .from('users')
      .select('retell_agent_id, business_name, name')
      .in('retell_agent_id', agentIds);

    (users || []).forEach(u => {
      agentMap[u.retell_agent_id] = u.business_name || u.name || 'Unknown';
    });
  }

  // Compute stats
  const total = calls?.length || 0;
  const booked = (calls || []).filter(c =>
    c.call_summary?.toLowerCase().includes('appointment') ||
    c.call_summary?.toLowerCase().includes('booked') ||
    c.call_status === 'appointment_booked'
  ).length;
  const missed = (calls || []).filter(c => c.call_status === 'ended' && !c.transcript).length;

  const durations = (calls || [])
    .filter(c => c.start_timestamp && c.end_timestamp)
    .map(c => (new Date(c.end_timestamp) - new Date(c.start_timestamp)) / 1000);
  const avgDuration = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;

  // Daily volume for chart (last N days)
  const dailyMap = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toLocaleDateString('en-CA');
    dailyMap[d] = 0;
  }
  (calls || []).forEach(c => {
    if (c.start_timestamp) {
      const d = new Date(c.start_timestamp).toLocaleDateString('en-CA');
      if (d in dailyMap) dailyMap[d]++;
    }
  });

  return NextResponse.json({
    stats: { total, booked, missed, avgDuration, bookingRate: total ? Math.round((booked / total) * 100) : 0 },
    daily: Object.entries(dailyMap).map(([date, count]) => ({ date, count })),
    calls: (calls || []).map(c => ({
      ...c,
      clientName: agentMap[c.agent_id] || 'TheHypeBox',
      durationSec: c.start_timestamp && c.end_timestamp
        ? Math.round((new Date(c.end_timestamp) - new Date(c.start_timestamp)) / 1000)
        : null,
    })),
  });
}
