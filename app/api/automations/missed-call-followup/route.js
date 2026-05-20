import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { sendSMS } from '@/lib/twilio';

export async function POST(request) {
  try {
    const { phone_number, business_name, ghl_api_key, ghl_location_id, client_id } = await request.json();

    if (!phone_number || !business_name) {
      return NextResponse.json(
        { ok: false, error: 'phone_number and business_name are required' },
        { status: 400 }
      );
    }

    await sendSMS(
      phone_number,
      `Hi! Sorry we missed your call at ${business_name}. How can we help? Reply here and we'll get right back to you!`,
      { apiKey: ghl_api_key, locationId: ghl_location_id }
    );

    const supabase = createClient();
    supabase.from('missed_calls').insert({
      from_number: phone_number,
      business_name,
      client_id: client_id ?? null,
      timestamp: new Date().toISOString(),
      text_sent: true,
    }).then().catch((e) => console.error('[missed-call-followup] log failed:', e.message));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[missed-call-followup]', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
