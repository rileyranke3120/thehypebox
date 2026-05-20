import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { auth } from '@/auth';

const VALID_AUTOMATIONS = [
  'review-request',
  'reactivation',
  'appointment-reminder',
  'post-service-followup',
  'lead-nurture',
  'missed-call-followup',
];

export async function POST(request) {
  // Allow authenticated super_admin OR a webhook secret header for GHL/external callers
  const session = await auth();
  const webhookSecret = process.env.AUTOMATION_WEBHOOK_SECRET;
  const reqSecret = request.headers.get('x-webhook-secret');
  const isAdmin = session?.user?.role === 'super_admin';
  const isWebhook = webhookSecret && reqSecret === webhookSecret;
  if (!isAdmin && !isWebhook) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient();
  let automation, client_id, payload;

  try {
    ({ automation, client_id, payload } = await request.json());

    if (!automation || !client_id || !payload) {
      return NextResponse.json(
        { ok: false, error: 'automation, client_id, and payload are required' },
        { status: 400 }
      );
    }

    if (!VALID_AUTOMATIONS.includes(automation)) {
      return NextResponse.json(
        { ok: false, error: `Invalid automation. Must be one of: ${VALID_AUTOMATIONS.join(', ')}` },
        { status: 400 }
      );
    }

    // Look up client — include GHL credentials for per-client SMS routing
    const { data: client, error: clientError } = await supabase
      .from('users')
      .select('id, name, business_name, email, business_phone, ghl_api_key, ghl_location_id')
      .eq('id', client_id)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ ok: false, error: 'Client not found' }, { status: 404 });
    }

    // Merge business_name + GHL credentials (payload can override if needed)
    const mergedPayload = {
      business_name: client.business_name,
      ghl_api_key: client.ghl_api_key || undefined,
      ghl_location_id: client.ghl_location_id || undefined,
      client_id,
      ...payload,
    };

    // Build the internal URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    const automationUrl = `${baseUrl}/api/automations/${automation}`;

    const res = await fetch(automationUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mergedPayload),
    });

    const result = await res.json();
    const status = res.ok ? 'success' : 'failed';

    supabase.from('automation_logs').insert({
      client_id,
      automation,
      payload: mergedPayload,
      triggered_at: new Date().toISOString(),
      status,
    }).catch((e) => console.error('[automations/trigger] log failed:', e.message));

    if (!res.ok) {
      return NextResponse.json({ ok: false, error: result.error || 'Automation failed', status }, { status: res.status });
    }

    return NextResponse.json({ ok: true, status, result });
  } catch (error) {
    console.error('[automations/trigger]', error);

    supabase.from('automation_logs').insert({
      client_id: client_id || null,
      automation: automation || null,
      payload: payload || null,
      triggered_at: new Date().toISOString(),
      status: 'error',
    }).catch(() => {});

    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
