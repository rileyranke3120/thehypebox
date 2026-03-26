import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { sendSMS } from '@/lib/twilio';

export async function POST(request) {
  try {
    const { phone_number, customer_name, business_name } = await request.json();

    if (!phone_number || !customer_name || !business_name) {
      return NextResponse.json(
        { ok: false, error: 'phone_number, customer_name, and business_name are required' },
        { status: 400 }
      );
    }

    await sendSMS(
      phone_number,
      `Hi ${customer_name}! Thanks for choosing ${business_name}. We'd love your feedback — could you leave us a quick Google review? It means a lot to us!`
    );

    const supabase = createClient();
    await supabase.from('review_requests').insert({
      phone_number,
      customer_name,
      sent_at: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[review-request]', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
