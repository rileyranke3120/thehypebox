import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { safeCompare } from '@/lib/safe-compare';
import { withErrorMonitor } from '@/lib/error-monitor';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, '');
  if (process.env.NEXT_PUBLIC_APP_URL)  return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  if (process.env.VERCEL_URL)           return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

async function callAgent(agent, baseUrl, cronSecret, supabase, masterRunId) {
  const path  = `/api/cron/${agent}`;
  const start = Date.now();
  let ok = false, statusCode = null, result = null, error = null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 55_000);

  try {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${cronSecret}` },
      signal: controller.signal,
    });
    clearTimeout(timer);
    statusCode = res.status;
    result = await res.json().catch(() => ({}));
    ok = res.ok;
    if (!ok) error = result?.error || `HTTP ${statusCode}`;
  } catch (err) {
    clearTimeout(timer);
    error = err.name === 'AbortError' ? 'timed out after 55s' : err.message;
    ok = false;
  }

  const durationMs = Date.now() - start;
  console.log(`[master] ${agent} → ${ok ? 'ok' : 'FAIL'} (${durationMs}ms)${error ? ' — ' + error : ''}`);

  await supabase.from('cron_run_log').insert({
    master_run_id: masterRunId,
    agent,
    run_at:      new Date().toISOString(),
    ok,
    status_code: statusCode,
    result,
    error,
    duration_ms: durationMs,
  }).then(({ error: dbErr }) => {
    if (dbErr) console.warn(`[master] cron_run_log insert failed (${agent}):`, dbErr.message);
  });

  return { agent, ok, error, durationMs };
}

async function handler(request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET) {
    console.error('[master] CRON_SECRET not set');
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  if (!safeCompare(authHeader ?? '', `Bearer ${process.env.CRON_SECRET}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase   = createClient();
  const baseUrl    = getBaseUrl();
  const cronSecret = process.env.CRON_SECRET;
  const startedAt  = new Date();
  const today      = startedAt.toISOString().split('T')[0];

  // Create master run record
  const { data: runRow, error: runErr } = await supabase
    .from('master_cron_log')
    .insert({ run_date: today, started_at: startedAt.toISOString() })
    .select('id')
    .single();

  if (runErr) {
    console.warn('[master] master_cron_log insert failed:', runErr.message);
  }
  const masterRunId = runRow?.id ?? null;

  console.log(`[master] 7am run started — ${today} | baseUrl=${baseUrl}`);

  // ── Agent pipeline (sequential, self-healing) ──────────────────────────────

  const agents = [
    // Scrape fresh leads from Google Maps → push to GHL (runs daily, rotates city)
    { agent: 'scrape-leads' },

    // Score newly scraped (untagged) contacts with rule-based + Claude
    { agent: 'lead-score' },

    // Find email addresses for scraped contacts via Hunter.io + website scraping
    { agent: 'email-finder' },

    // Send initial SMS to uncontacted scraped leads (Barry)
    { agent: 'barry-outbound' },

    // Send personalized cold email to contacts with a found email (Barry)
    { agent: 'barry-email' },

    // Send 3-step email follow-up sequence (day 3 + day 7) to non-responders
    { agent: 'email-followup' },

    // Send follow-up sequences to contacts already reached (48h, 48h, cold, 30d reactivation)
    { agent: 'follow-up' },

    // AI churn risk prediction per active client
    { agent: 'churn-prediction' },

    // AI health score per active client (7-day activity)
    { agent: 'client-health' },

    // Flag Launch Box clients hitting usage thresholds for upsell
    { agent: 'upsell-detector' },

    // Fire any pending demo sequence steps (confirm, reminder, follow-up, breakup)
    { agent: 'demo-sequences' },

    // Generate and SMS morning briefing last (can reference today's run context)
    { agent: 'morning-digest' },

    // Pull Stripe revenue metrics and SMS Riley a daily dashboard
    { agent: 'stripe-dashboard' },
  ];

  const results  = [];
  const failures = [];

  for (const { agent } of agents) {
    const result = await callAgent(agent, baseUrl, cronSecret, supabase, masterRunId);
    results.push(result);
    if (!result.ok) failures.push(result);
  }

  // Update master run record with final stats
  const completedAt = new Date();
  await supabase
    .from('master_cron_log')
    .update({
      completed_at: completedAt.toISOString(),
      total_steps:  results.length,
      failed_steps: failures.length,
      total_ms:     completedAt.getTime() - startedAt.getTime(),
    })
    .eq('id', masterRunId);

  const summary = {
    ok:       failures.length === 0,
    date:     today,
    steps:    results.length,
    failed:   failures.length,
    totalMs:  completedAt.getTime() - startedAt.getTime(),
    results,
  };

  if (failures.length > 0) {
    console.warn(`[master] ${failures.length} agent(s) failed:`, failures.map(f => f.agent).join(', '));
  }
  console.log(`[master] complete — ${results.length} agents, ${failures.length} failures, ${summary.totalMs}ms`);

  return NextResponse.json(summary);
}

export const GET = withErrorMonitor('master', handler);
