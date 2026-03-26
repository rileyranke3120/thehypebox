import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { sendSMS } from '@/lib/twilio';

export async function POST(request) {
  try {
    const { phone_number, customer_name, business_name, appointment_time } = await request.json();

    if (!phone_number || !customer_name || !business_name || !appointment_time) {
      return NextResponse.json(
        { ok: false, error: 'phone_number, customer_name, business_name, and appointment_time are required' },
        { status: 400 }
      );
    }

    await sendSMS(
      phone_number,
      `Hi ${customer_name}! Just a reminder you have an appointment at ${business_name} tomorrow at ${appointment_time}. Reply CONFIRM to confirm or CANCEL to cancel.`
    );

    const supabase = createClient();
    await supabase.from('appointment_reminders').insert({
      phone_number,
      customer_name,
      appointment_time,
      sent_at: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[appointment-reminder]', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
