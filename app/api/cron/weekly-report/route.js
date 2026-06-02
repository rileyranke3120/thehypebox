import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { sendEmail } from '@/lib/send-email';
import { safeCompare } from '@/lib/safe-compare';

export const dynamic = 'force-dynamic';

const PLAN_PRICES = { launch: 97, starter: 97, rocket: 297, growth: 297, velocity: 497, pro: 497 };
const PLAN_LABELS = { launch: 'Launch Box', starter: 'Launch Box', rocket: 'Rocket Box', growth: 'Rocket Box', velocity: 'Velocity Box', pro: 'Velocity Box' };

function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function stat(label, value, color = '#fff') {
  return `
    <td style="padding:0 8px 0 0;width:25%;">
      <div style="background:#111;border:1px solid #1a1a1a;border-radius:6px;padding:14px 16px;">
        <div style="font-size:0.65rem;color:#555;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">${label}</div>
        <div style="font-size:1.4rem;font-weight:800;color:${color};line-height:1;">${value}</div>
      </div>
    </td>`;
}

function userRow(u) {
  const plan = esc(PLAN_LABELS[u.plan] || u.plan || '—');
  const daysLeft = u.trial_ends_at
    ? Math.ceil((new Date(u.trial_ends_at) - Date.now()) / 86400000)
    : null;
  const dayStr = daysLeft != null ? ` · ${daysLeft}d left` : '';
  return `<tr style="border-bottom:1px solid #1a1a1a;">
    <td style="padding:8px 12px;font-size:0.8rem;color:#fff;">${esc(u.name || u.email)}</td>
    <td style="padding:8px 12px;font-size:0.75rem;color:#aaa;">${esc(u.email)}</td>
    <td style="padding:8px 12px;font-size:0.72rem;color:#FFD000;font-weight:700;text-transform:uppercase;">${plan}${dayStr}</td>
  </tr>`;
}

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET) {
    console.error('[cron] CRON_SECRET env var is not set');
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 });
  }
  if (!safeCompare(authHeader ?? '', `Bearer ${process.env.CRON_SECRET ?? ''}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
  const supabase = createClient();
  const now = new Date();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const weekAhead = new Date(Date.now() + 7 * 86400000).toISOString();

  const [{ data: usersData }, { data: callsData }, { data: autosData }] = await Promise.all([
    supabase.from('users').select('plan,plan_status,created_at,trial_ends_at,name,email').not('plan_status', 'is', null),
    supabase.from('retell_calls').select('call_id,call_status,call_summary').gte('created_at', weekAgo),
    supabase.from('automation_logs').select('id').gte('triggered_at', weekAgo),
  ]);

  const users_ = usersData || [];
  const calls_ = callsData || [];
  const autos_ = autosData || [];

  const mrr = users_
    .filter(u => u.plan_status === 'active' || u.plan_status === 'trialing')
    .reduce((sum, u) => sum + (PLAN_PRICES[u.plan] || 0), 0);

  const activeCount = users_.filter(u => u.plan_status === 'active').length;
  const trialingCount = users_.filter(u => u.plan_status === 'trialing').length;
  const pastDueCount = users_.filter(u => u.plan_status === 'past_due').length;
  const canceledCount = users_.filter(u => u.plan_status === 'canceled').length;

  const newSignups = users_.filter(u => u.created_at >= weekAgo);
  const trialsExpiring = users_.filter(u =>
    u.plan_status === 'trialing' && u.trial_ends_at &&
    u.trial_ends_at > now.toISOString() && u.trial_ends_at < weekAhead
  );
  const pastDueUsers = users_.filter(u => u.plan_status === 'past_due');

  const callsCount = calls_.length;
  const bookedCount = calls_.filter(c =>
    c.call_summary?.toLowerCase().includes('appointment') ||
    c.call_summary?.toLowerCase().includes('booked')
  ).length;
  const bookingRate = callsCount ? Math.round((bookedCount / callsCount) * 100) : 0;
  const automationsCount = autos_.length;

  const weekLabel = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:system-ui,-apple-system,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:40px 24px;">

  <div style="margin-bottom:8px;">
    <span style="font-size:1.3rem;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:#FFD000;">THE HYPE BOX</span>
  </div>
  <div style="margin-bottom:28px;">
    <span style="font-size:0.72rem;color:#555;letter-spacing:0.1em;text-transform:uppercase;">Weekly Report — ${weekLabel}</span>
  </div>

  <h1 style="font-size:1.25rem;font-weight:800;color:#fff;margin:0 0 20px;">
    $${mrr.toLocaleString()}/mo MRR &nbsp;·&nbsp; ${users_.length} total clients
  </h1>

  <!-- Stats row 1 -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
    <tr>
      ${stat('MRR', '$' + mrr.toLocaleString(), '#FFD000')}
      ${stat('Active', activeCount, '#4CAF50')}
      ${stat('Trialing', trialingCount, '#FFD000')}
      ${stat('Past Due', pastDueCount, pastDueCount > 0 ? '#FF8C00' : '#555')}
    </tr>
  </table>
  <!-- Stats row 2 -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
    <tr>
      ${stat('Calls (7d)', callsCount, '#fff')}
      ${stat('Booked', bookedCount, '#4CAF50')}
      ${stat('Booking Rate', bookingRate + '%', bookingRate >= 30 ? '#4CAF50' : bookingRate >= 15 ? '#FFD000' : '#FF8C00')}
      ${stat('Automations (7d)', automationsCount, '#888')}
    </tr>
  </table>

  ${newSignups.length > 0 ? `
  <!-- New signups -->
  <div style="margin-bottom:24px;">
    <div style="font-size:0.7rem;color:#555;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:10px;">
      New Signups This Week (${newSignups.length})
    </div>
    <div style="background:#111;border:1px solid #1a1a1a;border-radius:8px;overflow:hidden;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="border-bottom:1px solid #222;">
            <th style="padding:8px 12px;text-align:left;font-size:0.65rem;color:#555;text-transform:uppercase;letter-spacing:0.08em;">Name</th>
            <th style="padding:8px 12px;text-align:left;font-size:0.65rem;color:#555;text-transform:uppercase;letter-spacing:0.08em;">Email</th>
            <th style="padding:8px 12px;text-align:left;font-size:0.65rem;color:#555;text-transform:uppercase;letter-spacing:0.08em;">Plan</th>
          </tr>
        </thead>
        <tbody>${newSignups.map(userRow).join('')}</tbody>
      </table>
    </div>
  </div>
  ` : `
  <div style="padding:16px;background:#111;border:1px solid #1a1a1a;border-radius:8px;color:#555;font-size:0.85rem;margin-bottom:24px;">
    No new signups this week.
  </div>
  `}

  ${trialsExpiring.length > 0 ? `
  <!-- Trials expiring -->
  <div style="margin-bottom:24px;">
    <div style="font-size:0.7rem;color:#FF8C00;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:10px;">
      Trials Expiring This Week (${trialsExpiring.length}) — follow up!
    </div>
    <div style="background:#111;border:1px solid #2a1a00;border-radius:8px;overflow:hidden;">
      <table style="width:100%;border-collapse:collapse;">
        <tbody>${trialsExpiring.map(userRow).join('')}</tbody>
      </table>
    </div>
  </div>
  ` : ''}

  ${pastDueUsers.length > 0 ? `
  <!-- Past due -->
  <div style="margin-bottom:24px;">
    <div style="font-size:0.7rem;color:#E24B4A;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:10px;">
      Past Due — Card Issues (${pastDueUsers.length})
    </div>
    <div style="background:#111;border:1px solid #2a0a0a;border-radius:8px;overflow:hidden;">
      <table style="width:100%;border-collapse:collapse;">
        <tbody>${pastDueUsers.map(userRow).join('')}</tbody>
      </table>
    </div>
  </div>
  ` : ''}

  <div style="margin-top:8px;padding-top:20px;border-top:1px solid #1a1a1a;">
    <p style="font-size:0.75rem;color:#555;margin:0;line-height:1.8;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/admin/clients" style="color:#FFD000;">Admin Dashboard</a>
      &nbsp;·&nbsp; ${canceledCount} canceled all-time &nbsp;·&nbsp; Generated ${weekLabel}
    </p>
  </div>

</div>
</body>
</html>`;

  await sendEmail({
    to: 'riley@thehypeboxllc.com',
    subject: `TheHypeBox Weekly — $${mrr.toLocaleString()} MRR · ${newSignups.length} new · ${trialsExpiring.length} expiring`,
    html,
  });

  return NextResponse.json({
    ok: true,
    mrr,
    newSignups: newSignups.length,
    trialsExpiring: trialsExpiring.length,
    pastDue: pastDueCount,
    calls: callsCount,
  });
  } catch (err) {
    console.error('[weekly-report] cron error:', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
