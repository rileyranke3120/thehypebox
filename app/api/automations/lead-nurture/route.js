import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { sendSMS } from '@/lib/twilio';
import { auth } from '@/auth';
import { insertWithRetry } from '@/lib/insert-with-retry';
import { safeCompare } from '@/lib/safe-compare';

const STEP_MESSAGES = {
  1: (name, biz) =>
    `Hi ${name}! Thanks for your interest in ${biz}. We'd love to help — when's a good time to chat? Reply here anytime!`,
  2: (name, biz) =>
    `Hey ${name}! Just following up from ${biz}. We have a special offer this week — reply to find out more!`,
  3: (_name, biz) =>
    `Last follow up from ${biz} — we don't want to bother you but we'd hate for you to miss out. Reply STOP to opt out or YES to learn more!`,
};

export async function POST(request) {
  const session = await auth();
  const secret = process.env.AUTOMATION_WEBHOOK_SECRET;
  const isAdmin = session?.user?.role === 'super_admin';
  const isWebhook = secret && safeCompare(request.headers.get('x-webhook-secret') ?? '', secret);
  if (!isAdmin && !isWebhook) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { phone_number, customer_name, business_name, step, client_id } = await request.json();

    if (!phone_number || !customer_name || !business_name || !step) {
      return NextResponse.json(
        { ok: false, error: 'phone_number, customer_name, business_name, and step are required' },
        { status: 400 }
      );
    }

    if (customer_name.length > 100) return NextResponse.json({ ok: false, error: 'customer_name must be 100 characters or fewer.' }, { status: 400 });

    if (!client_id) {
      return NextResponse.json({ ok: false, error: 'client_id is required' }, { status: 400 });
    }

    const stepNum = Number(step);
    const buildMessage = STEP_MESSAGES[stepNum];

    if (!buildMessage) {
      return NextResponse.json(
        { ok: false, error: 'step must be 1, 2, or 3' },
        { status: 400 }
      );
    }

    // Look up GHL credentials fresh from DB — never trust keys in request body
    const supabase = createClient();
    const { data: clientData } = await supabase
      .from('users')
      .select('ghl_api_key, ghl_location_id')
      .eq('id', client_id)
      .single();

    if (!clientData?.ghl_api_key || !clientData?.ghl_location_id) {
      return NextResponse.json({ ok: false, error: 'Client GHL credentials not configured' }, { status: 400 });
    }

    await sendSMS(phone_number, buildMessage(customer_name, business_name), {
      apiKey: clientData.ghl_api_key,
      locationId: clientData.ghl_location_id,
    });

    await insertWithRetry(supabase, 'lead_nurture', {
      phone_number,
      customer_name,
      step: stepNum,
      client_id,
      sent_at: new Date().toISOString(),
    }, { tag: '[lead-nurture]' });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[lead-nurture]', error);
    return NextResponse.json({ ok: false, error: 'Something went wrong.' }, { status: 500 });
  }
}
