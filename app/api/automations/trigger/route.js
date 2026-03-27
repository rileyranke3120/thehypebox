import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

const VALID_AUTOMATIONS = [
  'review-request',
  'reactivation',
  'appointment-reminder',
  'post-service-followup',
  'lead-nurture',
  'missed-call-followup',
];

export async function POST(request) {
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

    // Look up client to get business_name
    const { data: client, error: clientError } = await supabase
      .from('users')
      .select('id, name, business_name, email, business_phone')
      .eq('id', client_id)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ ok: false, error: 'Client not found' }, { status: 404 });
    }

    // Merge business_name from client record if not already in payload
    const mergedPayload = {
      business_name: client.business_name,
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

    await supabase.from('automation_logs').insert({
      client_id,
      automation,
      payload: mergedPayload,
      triggered_at: new Date().toISOString(),
      status,
    });

    if (!res.ok) {
      return NextResponse.json({ ok: false, error: result.error || 'Automation failed', status }, { status: res.status });
    }

    return NextResponse.json({ ok: true, status, result });
  } catch (error) {
    console.error('[automations/trigger]', error);

    // Best-effort log of the failure
    try {
      await supabase.from('automation_logs').insert({
        client_id: client_id || null,
        automation: automation || null,
        payload: payload || null,
        triggered_at: new Date().toISOString(),
        status: 'error',
      });
    } catch (_) {}

    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
