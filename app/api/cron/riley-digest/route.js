import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { sendEmail } from '@/lib/send-email';
import { safeCompare } from '@/lib/safe-compare';

export const dynamic = 'force-dynamic';

function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const PLAN_PRICES = { launch: 97, starter: 97, rocket: 297, growth: 297, velocity: 497, pro: 497 };
const PLAN_LABELS = { launch: 'Launch Box', starter: 'Launch Box', rocket: 'Rocket Box', growth: 'Rocket Box', velocity: 'Velocity Box', pro: 'Velocity Box' };
const YELLOW = '#FFD000';
const APP_URL = 'https://thehypeboxllc.com';

// ── HTML helpers ──────────────────────────────────────────────

function statBox(label, value, color = '#fff', subtext = '') {
  return `
    <td style="padding:0 8px 8px 0;width:25%;vertical-align:top;">
      <div style="background:#111;border:1px solid #1f1f1f;border-radius:6px;padding:14px 14px 12px;">
        <div style="font-size:0.6rem;color:#555;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;">${label}</div>
        <div style="font-size:1.6rem;font-weight:900;color:${color};line-height:1;">${value}</div>
        ${subtext ? `<div style="font-size:0.65rem;color:#555;margin-top:5px;">${subtext}</div>` : ''}
      </div>
    </td>`;
}

function sectionHeader(label, count, color = '#555') {
  return `
    <div style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.12em;color:${color};margin:24px 0 8px;display:flex;justify-content:space-between;">
      <span>${label}</span>
      ${count != null ? `<span style="color:#333;">${count}</span>` : ''}
    </div>`;
}

function clientRow(u, subtext) {
  const plan = PLAN_LABELS[u.plan] || u.plan || '—';
  return `
    <tr style="border-bottom:1px solid #161616;">
      <td style="padding:8px 10px;font-size:0.82rem;color:#ddd;">${esc(u.name || u.email)}</td>
      <td style="padding:8px 10px;font-size:0.72rem;color:#666;">${esc(u.email)}</td>
      <td style="padding:8px 10px;font-size:0.68rem;color:${YELLOW};font-weight:700;text-transform:uppercase;white-space:nowrap;">${esc(plan)}</td>
      ${subtext ? `<td style="padding:8px 10px;font-size:0.68rem;color:#555;white-space:nowrap;">${esc(subtext)}</td>` : ''}
    </tr>`;
}

function clientTable(rows, hasSubtext = false) {
  if (!rows.length) {
    return `<div style="padding:12px 14px;background:#111;border:1px solid #1a1a1a;border-radius:6px;color:#444;font-size:0.8rem;">None</div>`;
  }
  return `
    <div style="background:#111;border:1px solid #1a1a1a;border-radius:6px;overflow:hidden;">
      <table style="width:100%;border-collapse:collapse;">
        <tbody>${rows.map((r) => clientRow(r.user, r.sub)).join('')}</tbody>
      </table>
    </div>`;
}

function emptyBlock(text) {
  return `<div style="padding:10px 14px;background:#111;border:1px solid #1a1a1a;border-radius:6px;color:#444;font-size:0.78rem;">${text}</div>`;
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

  const supabase = createClient();
  const now = new Date();
  const ago24h  = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const ago7d   = new Date(now - 7  * 24 * 60 * 60 * 1000).toISOString();
  const in3d    = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();

  // ── Fetch all data in parallel ────────────────────────────
  const [
    { data: allUsers },
    { data: recentCalls },
  ] = await Promise.all([
    supabase
      .from('users')
      .select('id, name, email, plan, plan_status, created_at, updated_at, trial_ends_at, retell_agent_id, last_login_at, role')
      .not('plan_status', 'is', null),
    supabase
      .from('retell_calls')
      .select('agent_id')
      .gte('start_timestamp', ago7d),
  ]);

  const users = (allUsers ?? []).filter((u) => u.role !== 'super_admin');

  // 1. New signups (last 24h)
  const newSignups = users.filter((u) => u.created_at >= ago24h);

  // 2. Cancellations (last 24h) — plan_status flipped to 'canceled' within 24h
  const cancellations = users.filter(
    (u) => u.plan_status === 'canceled' && u.updated_at >= ago24h
  );

  // 3. Active/trialing clients
  const activeUsers = users.filter((u) =>
    u.plan_status === 'active' || u.plan_status === 'trialing'
  );
  const activeCount  = users.filter((u) => u.plan_status === 'active').length;
  const trialingCount = users.filter((u) => u.plan_status === 'trialing').length;

  // 4. Zero logins in 7 days — clients who signed up >7 days ago with no recent login
  const zeroLogins = activeUsers.filter((u) => {
    if (u.created_at >= ago7d) return false; // too new to flag
    return !u.last_login_at || u.last_login_at < ago7d;
  });

  // 5. Zero Sarah calls in 7 days — active clients with a Retell agent but no calls
  const agentsWithCalls = new Set((recentCalls ?? []).map((c) => c.agent_id).filter(Boolean));
  const zeroCallClients = activeUsers.filter(
    (u) => u.retell_agent_id && !agentsWithCalls.has(u.retell_agent_id) && u.created_at < ago7d
  );

  // 6. MRR
  const mrr = activeUsers.reduce((sum, u) => sum + (PLAN_PRICES[u.plan] || 0), 0);

  // 7. Trials expiring in ≤3 days
  const trialsExpiring = activeUsers.filter(
    (u) =>
      u.plan_status === 'trialing' &&
      u.trial_ends_at &&
      u.trial_ends_at > now.toISOString() &&
      u.trial_ends_at <= in3d
  );

  // ── Build email ───────────────────────────────────────────
  const dateLabel = now.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    timeZone: 'America/New_York',
  });

  function rows(list, subFn) {
    return list.map((u) => ({ user: u, sub: subFn ? subFn(u) : '' }));
  }

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:system-ui,-apple-system,sans-serif;">
<div style="max-width:580px;margin:0 auto;padding:40px 24px;">

  <!-- Header -->
  <div style="margin-bottom:4px;">
    <span style="font-size:1.2rem;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:${YELLOW};">THE HYPE BOX</span>
  </div>
  <div style="margin-bottom:24px;">
    <span style="font-size:0.68rem;color:#444;letter-spacing:0.1em;text-transform:uppercase;">Daily Digest — ${dateLabel}</span>
  </div>

  <!-- Top-line stats -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:4px;" role="presentation">
    <tr>
      ${statBox('MRR', '$' + mrr.toLocaleString(), YELLOW)}
      ${statBox('Active', activeCount, '#1D9E75')}
      ${statBox('Trialing', trialingCount, '#378ADD')}
      ${statBox('New Today', newSignups.length, newSignups.length > 0 ? '#FFD000' : '#555')}
    </tr>
  </table>

  <!-- Cancellations alert row -->
  ${cancellations.length > 0 ? `
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px;" role="presentation">
    <tr>
      ${statBox('Canceled Today', cancellations.length, '#E24B4A')}
      ${statBox('Trials Expiring (3d)', trialsExpiring.length, trialsExpiring.length > 0 ? '#FF8C00' : '#555')}
      ${statBox('Zero Logins (7d)', zeroLogins.length, zeroLogins.length > 0 ? '#EF9F27' : '#555')}
      ${statBox('Silent Sarahs (7d)', zeroCallClients.length, zeroCallClients.length > 0 ? '#EF9F27' : '#555')}
    </tr>
  </table>
  ` : `
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px;" role="presentation">
    <tr>
      ${statBox('Canceled Today', 0, '#555', 'none')}
      ${statBox('Trials Expiring (3d)', trialsExpiring.length, trialsExpiring.length > 0 ? '#FF8C00' : '#555')}
      ${statBox('Zero Logins (7d)', zeroLogins.length, zeroLogins.length > 0 ? '#EF9F27' : '#555')}
      ${statBox('Silent Sarahs (7d)', zeroCallClients.length, zeroCallClients.length > 0 ? '#EF9F27' : '#555')}
    </tr>
  </table>
  `}

  <!-- New signups -->
  ${sectionHeader('New Signups (24h)', newSignups.length, newSignups.length > 0 ? YELLOW : '#333')}
  ${newSignups.length > 0
    ? clientTable(rows(newSignups, () => ''))
    : emptyBlock('No new signups in the last 24 hours.')}

  <!-- Cancellations -->
  ${sectionHeader('Cancellations (24h)', cancellations.length, cancellations.length > 0 ? '#E24B4A' : '#333')}
  ${cancellations.length > 0
    ? clientTable(rows(cancellations, () => ''))
    : emptyBlock('No cancellations in the last 24 hours.')}

  <!-- Trials expiring -->
  ${trialsExpiring.length > 0 ? `
  ${sectionHeader('Trials Expiring in 3 Days', trialsExpiring.length, '#FF8C00')}
  ${clientTable(rows(trialsExpiring, (u) => {
    const d = Math.ceil((new Date(u.trial_ends_at) - now) / 86400000);
    return `${d}d left`;
  }))}
  ` : ''}

  <!-- Zero logins -->
  ${sectionHeader('Zero Logins — 7 Days', zeroLogins.length, zeroLogins.length > 0 ? '#EF9F27' : '#333')}
  ${zeroLogins.length > 0
    ? clientTable(rows(zeroLogins, (u) => {
        if (!u.last_login_at) return 'never logged in';
        const d = Math.floor((now - new Date(u.last_login_at)) / 86400000);
        return `${d}d ago`;
      }))
    : emptyBlock('All active clients logged in within 7 days.')}

  <!-- Zero Sarah calls -->
  ${sectionHeader('Zero Sarah Calls — 7 Days', zeroCallClients.length, zeroCallClients.length > 0 ? '#EF9F27' : '#333')}
  ${zeroCallClients.length > 0
    ? clientTable(rows(zeroCallClients, () => 'no calls'))
    : emptyBlock('All Retell clients had calls in the last 7 days.')}

  <!-- Footer -->
  <div style="margin-top:32px;padding-top:20px;border-top:1px solid #161616;">
    <p style="font-size:0.72rem;color:#333;margin:0;line-height:1.8;">
      <a href="${APP_URL}/dashboard" style="color:${YELLOW};text-decoration:none;">Admin Dashboard</a>
      &nbsp;·&nbsp; Generated ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })} ET
    </p>
  </div>

</div>
</body>
</html>`;

  const urgentFlags = [];
  if (cancellations.length > 0) urgentFlags.push(`${cancellations.length} canceled`);
  if (trialsExpiring.length > 0) urgentFlags.push(`${trialsExpiring.length} trials expiring`);

  const subjectPrefix = urgentFlags.length > 0 ? `⚡ ${urgentFlags.join(' · ')} — ` : '';
  const subject = `${subjectPrefix}Daily Digest — $${mrr.toLocaleString()} MRR · ${activeCount} active`;

  try {
    await sendEmail({ to: 'riley@thehypeboxllc.com', subject, html });
  } catch (err) {
    console.error('[riley-digest] email failed:', err.message);
    return NextResponse.json({ error: 'Email send failed.' }, { status: 500 });
  }

  console.log(`[riley-digest] sent — mrr=$${mrr} active=${activeCount} signups=${newSignups.length} cancels=${cancellations.length}`);

  return NextResponse.json({
    ok: true,
    mrr,
    activeCount,
    trialingCount,
    newSignups: newSignups.length,
    cancellations: cancellations.length,
    zeroLogins: zeroLogins.length,
    zeroCallClients: zeroCallClients.length,
    trialsExpiring: trialsExpiring.length,
  });
}
