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

    // Resolve business_name: request body → Supabase profile → session name
    const supabase = createClient();
    const { data: user } = await supabase
      .from('users')
      .select('id, business_name')
      .eq('email', session.user.email)
      .single();

    const business_name = body.business_name || user?.business_name || session.user.name || 'our team';

    await sendSMS(
      phone_number,
      `Hi ${customer_name}! Thanks for choosing ${business_name}. We'd love your feedback — could you leave us a quick Google review? It means a lot to us!`
    );

    await supabase.from('review_requests').insert({
      phone_number,
      customer_name,
      client_id: user?.id ?? null,
      sent_at: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[review-request]', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
