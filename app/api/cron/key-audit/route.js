import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/send-email';

export const dynamic = 'force-dynamic';

async function testGHLKey(name, key, locationId) {
  if (!key) return { name, ok: false, detail: 'Key missing' };
  try {
    const endpoint = locationId
      ? `https://services.leadconnectorhq.com/locations/${locationId}`
      : 'https://services.leadconnectorhq.com/users/me';
    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${key}`, Version: '2021-07-28' },
      signal: AbortSignal.timeout(8000),
    });
    return { name, ok: res.ok, detail: res.ok ? null : `HTTP ${res.status}` };
  } catch (err) {
    return { name, ok: false, detail: err.message };
  }
}

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const agencyKey = process.env.GHL_AGENCY_KEY || process.env.GHL_AGENCY_API_KEY;

  // Test agency key and Dave's key
  const baseChecks = await Promise.all([
    testGHLKey('GHL Agency Key', agencyKey, null),
    testGHLKey("Dave's GHL Key", process.env.GHL_DAVE_API_KEY, process.env.GHL_DAVE_LOCATION_ID),
  ]);

  // Test all provisioned client locations via agency key
  let clientResults = [];
  if (agencyKey && url && serviceKey) {
    const h = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
    const res = await fetch(
      `${url}/rest/v1/users?select=name,email,ghl_location_id&ghl_location_id=not.is.null&plan_status=in.(active,trialing)`,
      { headers: h }
    );
    const clients = await res.json().catch(() => []);
    if (Array.isArray(clients) && clients.length) {
      const checks = await Promise.all(
        clients.map(c => testGHLKey(
          c.name || c.email,
          agencyKey,
          c.ghl_location_id
        ))
      );
      clientResults = checks;
    }
  }

  const allResults = [...baseChecks, ...clientResults];
  const failures = allResults.filter(r => !r.ok);

  const now = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const rows = allResults.map(r =>
    `<tr style="border-bottom:1px solid #1a1a1a;">
      <td style="padding:8px 12px;font-size:0.75rem;color:${r.ok ? '#4CAF50' : '#E24B4A'};">${r.ok ? '✓' : '✗'}</td>
      <td style="padding:8px 12px;font-size:0.8rem;color:#fff;">${r.name}</td>
      <td style="padding:8px 12px;font-size:0.75rem;color:#666;">${r.detail || 'OK'}</td>
    </tr>`
  ).join('');

  const subject = failures.length
    ? `⚠ GHL Key Audit — ${failures.length} issue${failures.length > 1 ? 's' : ''} found (${now})`
    : `✓ GHL Key Audit — All ${allResults.length} keys OK (${now})`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:system-ui,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:40px 24px;">
  <div style="margin-bottom:24px;">
    <span style="font-size:1.2rem;font-weight:900;letter-spacing:0.1em;text-transform:uppercase;color:#FFD000;">THE HYPE BOX</span>
    <span style="display:block;font-size:0.72rem;color:#555;letter-spacing:0.08em;text-transform:uppercase;margin-top:4px;">Monthly GHL Key Audit — ${now}</span>
  </div>

  ${failures.length > 0
    ? `<div style="padding:12px 16px;background:#2a0a0a;border:1px solid #4a1a1a;border-radius:6px;color:#E24B4A;font-size:0.875rem;margin-bottom:20px;">
        ${failures.length} key${failures.length > 1 ? 's' : ''} failed — action required.
       </div>`
    : `<div style="padding:12px 16px;background:#0a2a0a;border:1px solid #1a4a1a;border-radius:6px;color:#4CAF50;font-size:0.875rem;margin-bottom:20px;">
        All ${allResults.length} keys are working normally.
       </div>`}

  <div style="background:#111;border:1px solid #1a1a1a;border-radius:8px;overflow:hidden;">
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="border-bottom:1px solid #222;">
          <th style="padding:8px 12px;text-align:left;font-size:0.65rem;color:#555;text-transform:uppercase;letter-spacing:0.08em;"></th>
          <th style="padding:8px 12px;text-align:left;font-size:0.65rem;color:#555;text-transform:uppercase;letter-spacing:0.08em;">Key / Client</th>
          <th style="padding:8px 12px;text-align:left;font-size:0.65rem;color:#555;text-transform:uppercase;letter-spacing:0.08em;">Status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>

  <p style="font-size:0.75rem;color:#444;margin:20px 0 0;line-height:1.6;">
    <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/admin/highlevel" style="color:#FFD000;">GHL Provisioning Panel</a>
    &nbsp;·&nbsp; ${allResults.length} keys tested
  </p>
</div>
</body>
</html>`;

  await sendEmail({ to: 'riley@thehypeboxllc.com', subject, html });

  return NextResponse.json({
    ok: failures.length === 0,
    total: allResults.length,
    failures: failures.map(f => ({ name: f.name, detail: f.detail })),
  });
}
