import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { sendSMS } from '@/lib/twilio';

const STEP_MESSAGES = {
  1: (name, biz) =>
    `Hi ${name}! Thanks for your interest in ${biz}. We'd love to help — when's a good time to chat? Reply here anytime!`,
  2: (name, biz) =>
    `Hey ${name}! Just following up from ${biz}. We have a special offer this week — reply to find out more!`,
  3: (_name, biz) =>
    `Last follow up from ${biz} — we don't want to bother you but we'd hate for you to miss out. Reply STOP to opt out or YES to learn more!`,
};

export async function POST(request) {
  try {
    const { phone_number, customer_name, business_name, step } = await request.json();

    if (!phone_number || !customer_name || !business_name || !step) {
      return NextResponse.json(
        { ok: false, error: 'phone_number, customer_name, business_name, and step are required' },
        { status: 400 }
      );
    }

    const stepNum = Number(step);
    const buildMessage = STEP_MESSAGES[stepNum];

    if (!buildMessage) {
      return NextResponse.json(
        { ok: false, error: 'step must be 1, 2, or 3' },
        { status: 400 }
      );
    }

    await sendSMS(phone_number, buildMessage(customer_name, business_name));

    const supabase = createClient();
    await supabase.from('lead_nurture').insert({
      phone_number,
      customer_name,
      step: stepNum,
      sent_at: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[lead-nurture]', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
