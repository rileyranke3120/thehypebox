import { auth } from '@/auth';
import { createClient } from '@/lib/supabase';
import { sendSMS } from '@/lib/twilio';
import { NextResponse } from 'next/server';
import { insertWithRetry } from '@/lib/insert-with-retry';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VALID_STATUSES = ['active', 'trialing'];

// 10 SMS per hour per user — reuses the checkout rate-limit RPC, keyed by user email.
// Fails closed: if Supabase is unavailable, the request is blocked.
async function checkSmsRateLimit(email) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/check_and_increment_checkout_rate_limit`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_ip: `sms:${email}`, p_max: 10, p_window_seconds: 3600 }),
    });
    return res.ok ? await res.json() : false;
  } catch {
    return false;
  }
}

export async function POST(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'super_admin' && !VALID_STATUSES.includes(session.user.plan_status)) {
    return NextResponse.json({ ok: false, error: 'Subscription required.' }, { status: 402 });
  }

  if (!(await checkSmsRateLimit(session.user.email))) {
    return NextResponse.json({ ok: false, error: 'Too many SMS requests. Please wait before sending more.' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { phone_number, customer_name } = body;

    if (!phone_number || !customer_name) {
      return NextResponse.json(
        { ok: false, error: 'phone_number and customer_name are required' },
        { status: 400 }
      );
    }

    if (customer_name.length > 100) return NextResponse.json({ ok: false, error: 'customer_name must be 100 characters or fewer.' }, { status: 400 });

    if (body.business_name !== undefined && body.business_name.length > 200) {
      return NextResponse.json({ ok: false, error: 'business_name must be 200 characters or fewer.' }, { status: 400 });
    }

    const supabase = createClient();
    const { data: user } = await supabase
      .from('users')
      .select('id, business_name, google_review_url, ghl_api_key, ghl_location_id')
      .eq('email', session.user.email)
      .single();

    // Prefer the registered business name from DB over request body to prevent content manipulation.
    const business_name = user?.business_name || body.business_name || session.user.name || 'our team';
    const review_url = user?.google_review_url || null;

    const message = review_url
      ? `Hi ${customer_name}! Thanks for choosing ${business_name}. We'd love it if you left us a quick Google review — it means a lot to us! ${review_url}`
      : `Hi ${customer_name}! Thanks for choosing ${business_name}. We'd love your feedback — could you leave us a quick Google review? It means a lot to us!`;

    await sendSMS(phone_number, message, {
      apiKey: user?.ghl_api_key || null,
      locationId: user?.ghl_location_id || null,
    });

    await insertWithRetry(supabase, 'review_requests', {
      phone_number,
      customer_name,
      client_id: user?.id ?? null,
      sent_at: new Date().toISOString(),
    }, { tag: '[review-request]' });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[review-request]', error);
    return NextResponse.json({ ok: false, error: 'Something went wrong.' }, { status: 500 });
  }
}
