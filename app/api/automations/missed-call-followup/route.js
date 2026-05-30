import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { sendSMS } from '@/lib/twilio';
import { auth } from '@/auth';
import { insertWithRetry } from '@/lib/insert-with-retry';

export async function POST(request) {
  const session = await auth();
  const secret = process.env.AUTOMATION_WEBHOOK_SECRET;
  const isAdmin = session?.user?.role === 'super_admin';
  const isWebhook = secret && request.headers.get('x-webhook-secret') === secret;
  if (!isAdmin && !isWebhook) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { phone_number, business_name, client_id } = await request.json();

    if (!phone_number || !business_name) {
      return NextResponse.json(
        { ok: false, error: 'phone_number and business_name are required' },
        { status: 400 }
      );
    }

    if (!client_id) {
      return NextResponse.json({ ok: false, error: 'client_id is required' }, { status: 400 });
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

    await sendSMS(
      phone_number,
      `Hi! Sorry we missed your call at ${business_name}. How can we help? Reply here and we'll get right back to you!`,
      { apiKey: clientData.ghl_api_key, locationId: clientData.ghl_location_id }
    );

    await insertWithRetry(supabase, 'missed_calls', {
      from_number: phone_number,
      business_name,
      client_id,
      timestamp: new Date().toISOString(),
      text_sent: true,
    }, { tag: '[missed-call-followup]' });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[missed-call-followup]', error);
    return NextResponse.json({ ok: false, error: 'Something went wrong.' }, { status: 500 });
  }
}
