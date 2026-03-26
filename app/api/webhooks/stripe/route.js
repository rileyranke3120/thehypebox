import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { sendSMS } from '@/lib/twilio';

// NOTE: For production, install the `stripe` npm package and verify
// the webhook signature using stripe.webhooks.constructEvent() with
// STRIPE_WEBHOOK_SECRET to prevent spoofed requests.

export async function POST(request) {
  try {
    const event = await request.json();

    if (event.type !== 'checkout.session.completed') {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const session = event.data?.object;
    const email = session?.customer_details?.email || session?.customer_email || null;
    const name = session?.customer_details?.name || null;
    const phone = session?.customer_details?.phone || null;

    if (!email) {
      return NextResponse.json({ ok: false, error: 'No customer email in session' }, { status: 400 });
    }

    const supabase = createClient();
    await supabase.from('users').upsert(
      { email, name, plan: 'starter', created_at: new Date().toISOString() },
      { onConflict: 'email' }
    );

    if (phone) {
      await sendSMS(
        phone,
        "Welcome to TheHypeBox! Your account is ready. Log in at thehypeboxllc.com/login — Alex is already set up and answering your calls!"
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[stripe webhook]', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
