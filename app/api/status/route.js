import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const AGENTS = [
  'scrape-leads',
  'lead-score',
  'barry-outbound',
  'follow-up',
  'churn-prediction',
  'client-health',
  'upsell-detector',
  'demo-sequences',
  'morning-digest',
];

export async function GET() {
  const supabase = createClient();

  // Last 500 runs across all agents — group in JS to get latest per agent
  const { data, error } = await supabase
    .from('cron_run_log')
    .select('agent, run_at, ok, status_code, result, error, duration_ms')
    .in('agent', AGENTS)
    .order('run_at', { ascending: false })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Latest run per agent
  const byAgent = {};
  for (const row of data ?? []) {
    if (!byAgent[row.agent]) byAgent[row.agent] = row;
  }

  // Latest master run
  const { data: masterRuns } = await supabase
    .from('master_cron_log')
    .select('run_date, started_at, completed_at, total_steps, failed_steps, total_ms')
    .order('started_at', { ascending: false })
    .limit(1);

  return NextResponse.json({
    updated_at:  new Date().toISOString(),
    last_master: masterRuns?.[0] ?? null,
    agents:      byAgent,
  });
}
