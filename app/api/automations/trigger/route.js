import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { auth } from '@/auth';
import { insertWithRetry } from '@/lib/insert-with-retry';
import { safeCompare } from '@/lib/safe-compare';

const VALID_AUTOMATIONS = [
  // 'review-request', // session-only endpoint — not reachable via webhook; causes silent 401s in automation_logs
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
  const isWebhook = webhookSecret && safeCompare(reqSecret ?? '', webhookSecret);
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
      .select('id, name, business_name, email, business_phone')
      .eq('id', client_id)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ ok: false, error: 'Client not found' }, { status: 404 });
    }

    // Merge business_name into payload — DB value always wins; payload spread cannot override it
    const mergedPayload = {
      client_id,
      ...payload,
      business_name: client.business_name,
    };

    // Build the internal URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    const automationUrl = `${baseUrl}/api/automations/${automation}`;

    const internalHeaders = { 'Content-Type': 'application/json' };
    if (webhookSecret) internalHeaders['x-webhook-secret'] = webhookSecret;

    const res = await fetch(automationUrl, {
      method: 'POST',
      headers: internalHeaders,
      body: JSON.stringify(mergedPayload),
    });

    const result = await res.json();
    const status = res.ok ? 'success' : 'failed';

    await insertWithRetry(supabase, 'automation_logs', {
      client_id,
      automation,
      payload: mergedPayload,
      triggered_at: new Date().toISOString(),
      status,
    }, { tag: '[automations/trigger]' });

    if (!res.ok) {
      return NextResponse.json({ ok: false, error: result.error || 'Automation failed', status }, { status: res.status });
    }

    return NextResponse.json({ ok: true, status, result });
  } catch (error) {
    console.error('[automations/trigger]', error);

    await insertWithRetry(supabase, 'automation_logs', {
      client_id: client_id || null,
      automation: automation || null,
      payload: payload || null,
      triggered_at: new Date().toISOString(),
      status: 'error',
    }, { tag: '[automations/trigger]' });

    return NextResponse.json({ ok: false, error: 'Something went wrong.' }, { status: 500 });
  }
}
