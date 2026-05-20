import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { sendSMS } from '@/lib/twilio';

export async function POST(request) {
  try {
    const { phone_number, customer_name, business_name, appointment_time, ghl_api_key, ghl_location_id, client_id } = await request.json();

    if (!phone_number || !customer_name || !business_name || !appointment_time) {
      return NextResponse.json(
        { ok: false, error: 'phone_number, customer_name, business_name, and appointment_time are required' },
        { status: 400 }
      );
    }

    await sendSMS(
      phone_number,
      `Hi ${customer_name}! Just a reminder you have an appointment at ${business_name} tomorrow at ${appointment_time}. Reply CONFIRM to confirm or CANCEL to cancel.`,
      { apiKey: ghl_api_key, locationId: ghl_location_id }
    );

    const supabase = createClient();
    supabase.from('appointment_reminders').insert({
      phone_number,
      customer_name,
      business_name,
      appointment_time,
      client_id: client_id ?? null,
      sent_at: new Date().toISOString(),
    }).catch((e) => console.error('[appointment-reminder] log failed:', e.message));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[appointment-reminder]', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
