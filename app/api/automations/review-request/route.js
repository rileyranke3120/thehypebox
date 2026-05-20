import { auth } from '@/auth';
import { createClient } from '@/lib/supabase';
import { sendSMS } from '@/lib/twilio';
import { NextResponse } from 'next/server';

export async function POST(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { phone_number, customer_name } = body;

    if (!phone_number || !customer_name) {
      return NextResponse.json(
        { ok: false, error: 'phone_number and customer_name are required' },
        { status: 400 }
      );
    }

    const supabase = createClient();
    const { data: user } = await supabase
      .from('users')
      .select('id, business_name, google_review_url, ghl_api_key, ghl_location_id')
      .eq('email', session.user.email)
      .single();

    const business_name = body.business_name || user?.business_name || session.user.name || 'our team';
    const review_url = body.google_review_url || user?.google_review_url || null;

    const message = review_url
      ? `Hi ${customer_name}! Thanks for choosing ${business_name}. We'd love it if you left us a quick Google review — it means a lot to us! ${review_url}`
      : `Hi ${customer_name}! Thanks for choosing ${business_name}. We'd love your feedback — could you leave us a quick Google review? It means a lot to us!`;

    await sendSMS(phone_number, message, {
      apiKey: user?.ghl_api_key || session.user.ghl_api_key,
      locationId: user?.ghl_location_id || session.user.ghl_location_id,
    });

    supabase.from('review_requests').insert({
      phone_number,
      customer_name,
      client_id: user?.id ?? null,
      sent_at: new Date().toISOString(),
    }).catch((e) => console.error('[review-request] log failed:', e.message));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[review-request]', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
