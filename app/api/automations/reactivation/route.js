import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { sendSMS } from '@/lib/twilio';

export async function POST(request) {
  try {
    const { phone_number, customer_name, business_name, offer, ghl_api_key, ghl_location_id, client_id } = await request.json();

    if (!phone_number || !customer_name || !business_name || !offer) {
      return NextResponse.json(
        { ok: false, error: 'phone_number, customer_name, business_name, and offer are required' },
        { status: 400 }
      );
    }

    await sendSMS(
      phone_number,
      `Hey ${customer_name}! It's been a while since we've seen you at ${business_name}. We miss you! Come back in and get ${offer}. Reply to book!`,
      { apiKey: ghl_api_key, locationId: ghl_location_id }
    );

    const supabase = createClient();
    supabase.from('reactivation_campaigns').insert({
      phone_number,
      customer_name,
      client_id: client_id ?? null,
      sent_at: new Date().toISOString(),
    }).then().catch((e) => console.error('[reactivation] log failed:', e.message));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[reactivation]', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
