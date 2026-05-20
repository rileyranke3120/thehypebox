import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { sendSMS } from '@/lib/twilio';

export async function POST(request) {
  try {
    const { phone_number, customer_name, business_name, ghl_api_key, ghl_location_id, client_id } = await request.json();

    if (!phone_number || !customer_name || !business_name) {
      return NextResponse.json(
        { ok: false, error: 'phone_number, customer_name, and business_name are required' },
        { status: 400 }
      );
    }

    await sendSMS(
      phone_number,
      `Hi ${customer_name}! Thanks for visiting ${business_name} today. How was your experience? Reply 1-5 and we'll make sure you're taken care of!`,
      { apiKey: ghl_api_key, locationId: ghl_location_id }
    );

    const supabase = createClient();
    supabase.from('post_service_followups').insert({
      phone_number,
      customer_name,
      business_name,
      client_id: client_id ?? null,
      sent_at: new Date().toISOString(),
    }).catch((e) => console.error('[post-service-followup] log failed:', e.message));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[post-service-followup]', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
