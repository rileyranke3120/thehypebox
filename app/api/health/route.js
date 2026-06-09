import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const AGENTS = [
  'master',
  'scrape-leads',
  'lead-score',
  'barry-outbound',
  'barry-email',
  'follow-up',
  'email-finder',
  'email-followup',
  'churn-prediction',
  'client-health',
  'upsell-detector',
  'annual-upsell',
  'morning-digest',
  'weekly-report',
  'angi-scraper',
  'facebook-leads',
  'nps-survey',
  'onboarding-sequence',
  'stripe-dashboard',
  'social-publish',
  'cancellation-followup',
];

// >26h = missed a daily window
const STALE_MS = 26 * 60 * 60 * 1000;

function classify(row) {
  if (!row) return 'unknown';
  if (!row.ok) return 'red';
  const age = Date.now() - new Date(row.run_at).getTime();
  return age > STALE_MS ? 'yellow' : 'green';
}

export async function GET() {
  const supabase = createClient();

  // Latest run per agent from cron_run_log
  const { data: runRows, error: runErr } = await supabase
    .from('cron_run_log')
    .select('agent, run_at, ok, status_code, error, duration_ms')
    .in('agent', AGENTS)
    .order('run_at', { ascending: false })
    .limit(500);

  if (runErr) {
    return NextResponse.json({ error: runErr.message }, { status: 500 });
  }

  // Recent errors per agent (last 6h)
  const since6h = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { data: errRows } = await supabase
    .from('error_log')
    .select('agent, occurred_at, error_message')
    .in('agent', AGENTS)
    .gte('occurred_at', since6h)
    .order('occurred_at', { ascending: false });

  // Latest master run
  const { data: masterRuns } = await supabase
    .from('master_cron_log')
    .select('run_date, started_at, completed_at, total_steps, failed_steps, total_ms')
    .order('started_at', { ascending: false })
    .limit(1);

  // Build latest-per-agent map
  const latestRun = {};
  for (const row of runRows ?? []) {
    if (!latestRun[row.agent]) latestRun[row.agent] = row;
  }

  // Build error count + latest error per agent
  const errorsByAgent = {};
  for (const row of errRows ?? []) {
    if (!errorsByAgent[row.agent]) errorsByAgent[row.agent] = { count: 0, latest: null };
    errorsByAgent[row.agent].count++;
    if (!errorsByAgent[row.agent].latest) errorsByAgent[row.agent].latest = row.error_message;
  }

  const agents = {};
  let worstStatus = 'green';

  for (const name of AGENTS) {
    const run    = latestRun[name] ?? null;
    const status = classify(run);
    const errs   = errorsByAgent[name] ?? { count: 0, latest: null };

    agents[name] = {
      status,
      last_run:        run?.run_at ?? null,
      last_ok:         run?.ok ?? null,
      last_error:      run?.error ?? null,
      duration_ms:     run?.duration_ms ?? null,
      recent_errors_6h: errs.count,
      latest_error:    errs.latest,
    };

    if (status === 'red' || (status === 'unknown' && worstStatus !== 'red')) {
      worstStatus = status === 'unknown' ? 'yellow' : 'red';
    } else if (status === 'yellow' && worstStatus === 'green') {
      worstStatus = 'yellow';
    }
  }

  return NextResponse.json({
    updated_at:  new Date().toISOString(),
    overall:     worstStatus,
    last_master: masterRuns?.[0] ?? null,
    agents,
  });
}
