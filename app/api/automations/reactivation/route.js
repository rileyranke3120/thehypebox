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
    const { phone_number, customer_name, business_name, offer, client_id } = await request.json();

    if (!phone_number || !customer_name || !business_name || !offer) {
      return NextResponse.json(
        { ok: false, error: 'phone_number, customer_name, business_name, and offer are required' },
        { status: 400 }
      );
    }

    if (customer_name.length > 100) return NextResponse.json({ ok: false, error: 'customer_name must be 100 characters or fewer.' }, { status: 400 });
    if (offer.length > 200) return NextResponse.json({ ok: false, error: 'offer must be 200 characters or fewer.' }, { status: 400 });

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
      `Hey ${customer_name}! It's been a while since we've seen you at ${business_name}. We miss you! Come back in and get ${offer}. Reply to book!`,
      { apiKey: clientData.ghl_api_key, locationId: clientData.ghl_location_id }
    );

    await insertWithRetry(supabase, 'reactivation_campaigns', {
      phone_number,
      customer_name,
      client_id,
      sent_at: new Date().toISOString(),
    }, { tag: '[reactivation]' });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[reactivation]', error);
    return NextResponse.json({ ok: false, error: 'Something went wrong.' }, { status: 500 });
  }
}
