import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { getContact, addContactNote } from '@/lib/ghl';
import { sendSMS } from '@/lib/twilio';
import { createClient } from '@/lib/supabase';
import { getGHLCredentials } from '@/lib/ghl-session';

const VALID_STATUSES = ['active', 'trialing'];
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 10 SMS per hour per user — shared bucket with review-request to prevent cross-endpoint bypass.
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

export async function GET(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'super_admin' && !VALID_STATUSES.includes(session.user.plan_status)) {
    return NextResponse.json({ error: 'Subscription required.' }, { status: 402 });
  }
  const { apiKey, locationId } = await getGHLCredentials(session);
  if (!apiKey) return NextResponse.json({ error: 'No GHL API key configured.' }, { status: 400 });

  try {
    const contact = await getContact(params.id, apiKey);
    if (!contact || contact.locationId !== locationId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ contact });
  } catch (err) {
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'super_admin' && !VALID_STATUSES.includes(session.user.plan_status)) {
    return NextResponse.json({ error: 'Subscription required.' }, { status: 402 });
  }
  const { apiKey, locationId } = await getGHLCredentials(session);
  if (!apiKey) return NextResponse.json({ error: 'No GHL API key configured.' }, { status: 400 });

  const body = await request.json();
  const { action } = body;

  try {
    // Verify the contact belongs to this client's location before any mutation
    const contact = await getContact(params.id, apiKey);
    if (!contact || contact.locationId !== locationId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (action === 'note') {
      const { text } = body;
      if (!text?.trim()) return NextResponse.json({ error: 'Note text required.' }, { status: 400 });
      if (text.length > 5000) return NextResponse.json({ error: 'Note must be 5000 characters or fewer.' }, { status: 400 });
      await addContactNote(params.id, text.trim(), apiKey);
      return NextResponse.json({ ok: true });
    }

    if (action === 'sms') {
      const SMS_PLANS = new Set(['rocket', 'velocity', 'pro', 'growth']);
      if (session.user.role !== 'super_admin' && !SMS_PLANS.has(session.user.plan)) {
        return NextResponse.json({ error: 'SMS requires Rocket plan or higher.' }, { status: 403 });
      }
      if (!(await checkSmsRateLimit(session.user.email))) {
        return NextResponse.json({ error: 'Too many SMS requests. Please wait before sending more.' }, { status: 429 });
      }
      const { phone, message } = body;
      if (!phone || !message) return NextResponse.json({ error: 'phone and message required.' }, { status: 400 });
      if (message.length > 500) return NextResponse.json({ error: 'Message must be 500 characters or fewer.' }, { status: 400 });
      if (body.name && body.name.length > 100) {
        return NextResponse.json({ error: 'Customer name must be 100 characters or fewer.' }, { status: 400 });
      }
      const phoneDigits = phone.replace(/\D/g, '');
      if (phoneDigits.length < 10 || phoneDigits.length > 15) {
        return NextResponse.json({ error: 'Invalid phone number.' }, { status: 400 });
      }
      await sendSMS(phone, message, { apiKey, locationId });

      const supabase = createClient();
      const { data: user } = await supabase.from('users').select('id').eq('email', session.user.email).single();
      await supabase.from('review_requests').insert({
        phone_number: phone,
        customer_name: body.name || 'Contact',
        client_id: user?.id ?? null,
        sent_at: new Date().toISOString(),
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
