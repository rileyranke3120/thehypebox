import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { sendSMS } from '@/lib/twilio';

export async function POST(request) {
  try {
    const payload = await request.json();

    const { call_id, from_number, start_timestamp, disconnection_reason } = payload;

    const missedReasons = ['no_answer', 'voicemail'];
    const isMissed = missedReasons.includes(disconnection_reason);

    let textSent = false;

    if (isMissed && from_number) {
      await sendSMS(
        from_number,
        "Hey! Sorry we missed your call at TheHypeBox. We'd love to help — reply here or visit thehypeboxllc.com to chat with Alex!"
      );
      textSent = true;
    }

    const supabase = createClient();
    await supabase.from('missed_calls').insert({
      call_id: call_id || null,
      from_number: from_number || null,
      timestamp: start_timestamp ? new Date(start_timestamp).toISOString() : new Date().toISOString(),
      text_sent: textSent,
    });

    return NextResponse.json({ ok: true, text_sent: textSent });
  } catch (error) {
    console.error('[retell webhook]', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
