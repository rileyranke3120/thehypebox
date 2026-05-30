import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/send-email';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const CHECKS = [];

async function checkGHLAgency() {
  const key = process.env.GHL_AGENCY_KEY || process.env.GHL_AGENCY_API_KEY;
  if (!key) return { name: 'GHL Agency Key', ok: false, detail: 'Env var missing' };
  const companyId = process.env.GHL_COMPANY_ID;
  if (!companyId) return { name: 'GHL Agency Key', ok: false, detail: 'GHL_COMPANY_ID env var missing' };
  try {
    const res = await fetch(`https://services.leadconnectorhq.com/locations/?companyId=${companyId}&limit=1`, {
      headers: { Authorization: `Bearer ${key}`, Version: '2021-07-28' },
      signal: AbortSignal.timeout(8000),
    });
    return { name: 'GHL Agency Key', ok: res.ok, detail: res.ok ? null : `HTTP ${res.status}` };
  } catch (err) {
    return { name: 'GHL Agency Key', ok: false, detail: err.message };
  }
}

async function checkGHLDaveKey() {
  const key = process.env.GHL_DAVE_API_KEY;
  const locationId = process.env.GHL_DAVE_LOCATION_ID;
  if (!key || !locationId) return { name: "Dave's GHL Key", ok: false, detail: 'Env vars missing' };
  try {
    const res = await fetch(`https://services.leadconnectorhq.com/locations/${locationId}`, {
      headers: { Authorization: `Bearer ${key}`, Version: '2021-07-28' },
      signal: AbortSignal.timeout(8000),
    });
    return { name: "Dave's GHL Key", ok: res.ok, detail: res.ok ? null : `HTTP ${res.status}` };
  } catch (err) {
    return { name: "Dave's GHL Key", ok: false, detail: err.message };
  }
}

async function checkRetell() {
  const key = process.env.RETELL_API_KEY;
  if (!key) return { name: 'Retell (Agents)', ok: false, detail: 'RETELL_API_KEY missing' };
  try {
    // Fetch all provisioned agent IDs from DB so this check stays valid as clients are added/removed
    const supabase = createClient();
    const { data: rows } = await supabase
      .from('users')
      .select('retell_agent_id, business_name')
      .not('retell_agent_id', 'is', null)
      .limit(20);

    if (!rows?.length) {
      return { name: 'Retell (Agents)', ok: true, detail: 'No agents provisioned yet' };
    }

    const failed = [];
    for (const row of rows) {
      const res = await fetch(`https://api.retellai.com/get-agent/${row.retell_agent_id}`, {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) failed.push(row.business_name || row.retell_agent_id);
    }

    return {
      name: `Retell (${rows.length} agent${rows.length > 1 ? 's' : ''})`,
      ok: failed.length === 0,
      detail: failed.length ? `Down: ${failed.join(', ')}` : null,
    };
  } catch (err) {
    return { name: 'Retell (Agents)', ok: false, detail: err.message };
  }
}

async function checkSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { name: 'Supabase', ok: false, detail: 'Env vars missing' };
  try {
    const res = await fetch(`${url}/rest/v1/users?limit=1&select=id`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    return { name: 'Supabase', ok: res.ok, detail: res.ok ? null : `HTTP ${res.status}` };
  } catch (err) {
    return { name: 'Supabase', ok: false, detail: err.message };
  }
}

async function checkAnthropicKey() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { name: 'Anthropic (Chat Widget)', ok: false, detail: 'ANTHROPIC_API_KEY missing — chat widget is broken' };
  return { name: 'Anthropic (Chat Widget)', ok: true, detail: null };
}

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET) {
    console.error('[cron] CRON_SECRET env var is not set');
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 });
  }
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = await Promise.all([
    checkGHLAgency(),
    checkGHLDaveKey(),
    checkRetell(),
    checkSupabase(),
    checkAnthropicKey(),
  ]);

  const failures = results.filter((r) => !r.ok);
  const allOk = failures.length === 0;

  if (!allOk) {
    const rows = results.map((r) =>
      `<tr>
        <td style="padding:8px 12px;font-size:0.875rem;color:${r.ok ? '#4CAF50' : '#E24B4A'};">${r.ok ? '✓' : '✗'}</td>
        <td style="padding:8px 12px;font-size:0.875rem;color:#fff;">${r.name}</td>
        <td style="padding:8px 12px;font-size:0.875rem;color:#888;">${r.detail || '—'}</td>
      </tr>`
    ).join('');

    await sendEmail({
      to: 'riley@thehypeboxllc.com',
      subject: `⚠ TheHypeBox Health Check — ${failures.length} issue${failures.length > 1 ? 's' : ''} detected`,
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="margin:0;padding:0;background:#0a0a0a;font-family:system-ui,sans-serif;">
          <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
            <div style="margin-bottom:24px;">
              <span style="font-size:1.2rem;font-weight:900;letter-spacing:0.1em;text-transform:uppercase;color:#FFD000;">THE HYPE BOX</span>
              <span style="display:block;font-size:0.75rem;color:#555;letter-spacing:0.08em;text-transform:uppercase;margin-top:4px;">Daily Health Check</span>
            </div>
            <div style="padding:12px 16px;background:#2a0a0a;border:1px solid #4a1a1a;border-radius:6px;color:#E24B4A;font-size:0.875rem;margin-bottom:24px;">
              ${failures.length} service${failures.length > 1 ? 's' : ''} need${failures.length === 1 ? 's' : ''} attention.
            </div>
            <table style="width:100%;border-collapse:collapse;background:#111;border:1px solid #1a1a1a;border-radius:8px;overflow:hidden;">
              <tr style="border-bottom:1px solid #222;">
                <th style="padding:10px 12px;text-align:left;font-size:0.7rem;color:#555;text-transform:uppercase;letter-spacing:0.08em;"></th>
                <th style="padding:10px 12px;text-align:left;font-size:0.7rem;color:#555;text-transform:uppercase;letter-spacing:0.08em;">Service</th>
                <th style="padding:10px 12px;text-align:left;font-size:0.7rem;color:#555;text-transform:uppercase;letter-spacing:0.08em;">Detail</th>
              </tr>
              ${rows}
            </table>
            <p style="font-size:0.8rem;color:#555;margin:24px 0 0;line-height:1.6;">
              Check <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/admin/clients" style="color:#FFD000;">your admin dashboard</a> for more details.
            </p>
          </div>
        </body>
        </html>
      `,
    });
  }

  return NextResponse.json({
    ok: allOk,
    checked: results.length,
    failures: failures.map((f) => ({ name: f.name, detail: f.detail })),
    timestamp: new Date().toISOString(),
  });
}
