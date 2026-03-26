import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { sendSMS } from '@/lib/twilio';

export async function POST(request) {
  try {
    const { phone_number, business_name } = await request.json();

    if (!phone_number || !business_name) {
      return NextResponse.json(
        { ok: false, error: 'phone_number and business_name are required' },
        { status: 400 }
      );
    }

    await sendSMS(
      phone_number,
      `Hi! Sorry we missed your call at ${business_name}. How can we help? Reply here and we'll get right back to you!`
    );

    const supabase = createClient();
    await supabase.from('missed_calls').insert({
      from_number: phone_number,
      business_name,
      timestamp: new Date().toISOString(),
      text_sent: true,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[missed-call-followup]', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
