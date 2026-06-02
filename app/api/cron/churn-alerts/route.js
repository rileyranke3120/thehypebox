import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { sendEmail } from '@/lib/send-email';
import { getOpportunities } from '@/lib/ghl';
import { safeCompare } from '@/lib/safe-compare';

export const dynamic = 'force-dynamic';

function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const YELLOW = '#FFD000';
const RED    = '#E24B4A';
const APP_URL = 'https://thehypeboxllc.com';

const PLAN_LABELS = {
  launch: 'Launch Box', starter: 'Launch Box',
  rocket: 'Rocket Box', growth:  'Rocket Box',
  velocity: 'Velocity Box', pro: 'Velocity Box',
};

const SIGNAL_META = {
  no_logins:       { label: 'Zero logins in 7 days',                     color: '#EF9F27' },
  no_calls:        { label: 'Zero Sarah calls in 7 days',                 color: '#EF9F27' },
  missed_no_book:  { label: 'Missed calls rising, no bookings (7d)',      color: '#FF8C00' },
  trial_no_pipe:   { label: 'Trial ending in 3 days — empty pipeline',    color: RED       },
};

// ── GHL pipeline check ────────────────────────────────────────

async function hasGhlPipeline(locationId, apiKey) {
  try {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('GHL timeout')), 5000)
    );
    const opps = await Promise.race([getOpportunities(locationId, apiKey), timeout]);
    return Array.isArray(opps) && opps.length > 0;
  } catch {
    // GHL is unreachable or timed out — don't flag the client
    return true;
  }
}

// ── Email builder ─────────────────────────────────────────────

function buildEmail(atRisk, generatedAt) {
  const dateLabel = generatedAt.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    timeZone: 'America/New_York',
  });

  function signalPill(key) {
    const m = SIGNAL_META[key];
    return `<span style="display:inline-block;background:#1a1100;border:1px solid ${m.color}44;color:${m.color};font-size:0.62rem;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;padding:2px 8px;border-radius:3px;margin:2px 4px 2px 0;">${m.label}</span>`;
  }

  const clientRows = atRisk.map(({ client, signals }) => {
    const plan = esc(PLAN_LABELS[client.plan] || client.plan || '—');
    const adminUrl = `${APP_URL}/dashboard/admin/clients/${client.id}`;
    const pills = signals.map(signalPill).join('');
    return `
      <tr style="border-bottom:1px solid #161616;">
        <td style="padding:14px 12px;vertical-align:top;">
          <div style="font-size:0.88rem;font-weight:700;color:#fff;margin-bottom:2px;">${esc(client.name || client.email)}</div>
          <div style="font-size:0.72rem;color:#555;margin-bottom:8px;">${esc(client.email)}</div>
          <div style="margin-bottom:6px;">${pills}</div>
        </td>
        <td style="padding:14px 12px;vertical-align:top;white-space:nowrap;text-align:right;">
          <div style="font-size:0.68rem;color:${YELLOW};font-weight:700;text-transform:uppercase;margin-bottom:8px;">${plan}</div>
          <a href="${adminUrl}" style="display:inline-block;background:#1a1400;border:1px solid ${YELLOW}55;color:${YELLOW};font-size:0.7rem;font-weight:700;padding:5px 12px;border-radius:3px;text-decoration:none;letter-spacing:0.05em;">
            View Client →
          </a>
        </td>
      </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:system-ui,-apple-system,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:40px 24px;">

  <div style="margin-bottom:4px;">
    <span style="font-size:1.2rem;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:${YELLOW};">THE HYPE BOX</span>
  </div>
  <div style="margin-bottom:24px;">
    <span style="font-size:0.68rem;color:#444;letter-spacing:0.1em;text-transform:uppercase;">Churn Alert — ${dateLabel}</span>
  </div>

  <div style="background:#1a0a0a;border:1px solid ${RED}44;border-left:3px solid ${RED};border-radius:4px;padding:16px 18px;margin-bottom:24px;">
    <div style="font-size:0.65rem;color:#666;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">At-Risk Clients</div>
    <div style="font-size:2rem;font-weight:900;color:${RED};line-height:1;">${atRisk.length}</div>
    <div style="font-size:0.75rem;color:#555;margin-top:4px;">${atRisk.length === 1 ? '1 client' : `${atRisk.length} clients`} triggered 2+ churn signals</div>
  </div>

  <div style="background:#111;border:1px solid #1f1f1f;border-radius:6px;overflow:hidden;margin-bottom:28px;">
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="border-bottom:1px solid #1f1f1f;background:#0d0d0d;">
          <th style="padding:10px 12px;text-align:left;font-size:0.6rem;color:#444;text-transform:uppercase;letter-spacing:0.1em;">Client</th>
          <th style="padding:10px 12px;text-align:right;font-size:0.6rem;color:#444;text-transform:uppercase;letter-spacing:0.1em;">Plan / Action</th>
        </tr>
      </thead>
      <tbody>${clientRows}</tbody>
    </table>
  </div>

  <div style="background:#111;border:1px solid #1f1f1f;border-radius:6px;padding:16px 18px;margin-bottom:28px;">
    <div style="font-size:0.62rem;color:#444;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:12px;">Signal Definitions</div>
    ${Object.entries(SIGNAL_META).map(([, m]) =>
      `<div style="margin-bottom:6px;"><span style="color:${m.color};font-size:0.75rem;font-weight:700;">▸</span> <span style="font-size:0.75rem;color:#666;">${m.label}</span></div>`
    ).join('')}
  </div>

  <div style="padding-top:20px;border-top:1px solid #161616;">
    <p style="font-size:0.7rem;color:#333;margin:0;line-height:1.8;">
      <a href="${APP_URL}/dashboard" style="color:${YELLOW};text-decoration:none;">Admin Dashboard</a>
      &nbsp;·&nbsp; Generated ${generatedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })} ET
    </p>
  </div>

</div>
</body>
</html>`;

  return {
    subject: `🚨 ${atRisk.length} at-risk ${atRisk.length === 1 ? 'client' : 'clients'} — churn alert`,
    html,
  };
}

// ── Route ─────────────────────────────────────────────────────

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET) {
    console.error('[cron] CRON_SECRET env var is not set');
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 });
  }
  if (!safeCompare(authHeader ?? '', `Bearer ${process.env.CRON_SECRET ?? ''}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now  = new Date();
  const ago7d = new Date(now - 7  * 24 * 60 * 60 * 1000).toISOString();
  const in3d  = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();

  const supabase = createClient();

  // ── Bulk Supabase fetch ───────────────────────────────────
  const [
    { data: rawUsers },
    { data: recentCalls },
    { data: recentMissed },
  ] = await Promise.all([
    supabase
      .from('users')
      .select('id, name, email, plan, plan_status, created_at, trial_ends_at, retell_agent_id, ghl_location_id, ghl_api_key, last_login_at, role')
      .in('plan_status', ['active', 'trialing']),
    supabase
      .from('retell_calls')
      .select('agent_id, call_summary')
      .gte('start_timestamp', ago7d),
    supabase
      .from('missed_calls')
      .select('client_id')
      .gte('timestamp', ago7d),
  ]);

  const users = (rawUsers ?? []).filter((u) => u.role !== 'super_admin');

  // Pre-build lookup sets from the call data
  const agentsWithCalls = new Set(
    (recentCalls ?? []).map((c) => c.agent_id).filter(Boolean)
  );
  const agentsWithBookings = new Set(
    (recentCalls ?? [])
      .filter((c) => {
        const s = (c.call_summary ?? '').toLowerCase();
        return s.includes('appointment') || s.includes('booked') || s.includes('scheduled');
      })
      .map((c) => c.agent_id)
      .filter(Boolean)
  );
  const clientsWithMissed = new Set(
    (recentMissed ?? []).map((c) => c.client_id).filter(Boolean)
  );

  // ── Evaluate signals per client ───────────────────────────
  const atRisk = [];

  for (const client of users) {
    const isNew = client.created_at >= ago7d; // signed up < 7 days ago — skip engagement signals
    const signals = [];

    // Signal 1: Zero logins in 7 days
    if (!isNew && (!client.last_login_at || client.last_login_at < ago7d)) {
      signals.push('no_logins');
    }

    // Signal 2: Zero Sarah calls in 7 days (only if agent is provisioned)
    if (!isNew && client.retell_agent_id && !agentsWithCalls.has(client.retell_agent_id)) {
      signals.push('no_calls');
    }

    // Signal 3: Missed calls occurring but no appointments booked in 7 days
    if (
      clientsWithMissed.has(client.id) &&
      (!client.retell_agent_id || !agentsWithBookings.has(client.retell_agent_id))
    ) {
      signals.push('missed_no_book');
    }

    // Signal 4: Trial ending in ≤3 days with no GHL pipeline activity
    // GHL call only for clients that are trialing, expiring soon, and have credentials
    if (
      client.plan_status === 'trialing' &&
      client.trial_ends_at &&
      client.trial_ends_at > now.toISOString() &&
      client.trial_ends_at <= in3d &&
      client.ghl_location_id &&
      client.ghl_api_key
    ) {
      const hasPipeline = await hasGhlPipeline(client.ghl_location_id, client.ghl_api_key);
      if (!hasPipeline) {
        signals.push('trial_no_pipe');
      }
    }

    if (signals.length >= 2) {
      atRisk.push({ client, signals });
    }
  }

  // Sort: most signals first
  atRisk.sort((a, b) => b.signals.length - a.signals.length);

  if (atRisk.length === 0) {
    console.log('[churn-alerts] no at-risk clients today');
    return NextResponse.json({ ok: true, atRisk: 0 });
  }

  const { subject, html } = buildEmail(atRisk, now);

  try {
    await sendEmail({ to: 'riley@thehypeboxllc.com', subject, html });
    console.log(`[churn-alerts] sent — ${atRisk.length} at-risk clients`);
  } catch (err) {
    console.error('[churn-alerts] email failed:', err.message);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    atRisk: atRisk.length,
    clients: atRisk.map(({ client, signals }) => ({
      email: client.email,
      signals,
    })),
  });
}
