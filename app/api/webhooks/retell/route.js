import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { sendSMS } from '@/lib/twilio';

export async function POST(request) {
  try {
    const payload = await request.json();

    console.log('[retell webhook] full payload:', JSON.stringify(payload, null, 2));

    const { event, call = {} } = payload;

    const {
      call_id,
      agent_id,
      call_status,
      caller_phone_number,
      from_number,
      start_timestamp,
      end_timestamp,
      transcript,
      call_analysis,
      disconnection_reason,
    } = call;

    const call_summary = call_analysis?.call_summary || null;

    console.log('[retell webhook] event:', event, '| call_status:', call_status, '| call_id:', call_id);

    // Normalize phone field — Retell uses caller_phone_number in v2, from_number in some older events
    const phone = caller_phone_number || from_number || null;

    const supabase = createClient();

    // Save full call record when call is complete — Retell v2 sends event==='call_analyzed',
    // older payloads may use call_status==='ended'
    if (event === 'call_analyzed' || call_status === 'ended') {
      const { error: upsertError } = await supabase.from('retell_calls').upsert({
        call_id:            call_id || null,
        agent_id:           agent_id || null,
        call_status,
        caller_phone_number: phone,
        start_timestamp:    start_timestamp ? new Date(start_timestamp).toISOString() : null,
        end_timestamp:      end_timestamp   ? new Date(end_timestamp).toISOString()   : null,
        transcript:         transcript  || null,
        call_summary:       call_summary || null,
      }, { onConflict: 'call_id' });

      if (upsertError) {
        console.error('[retell webhook] Supabase upsert error:', upsertError);
      } else {
        console.log('[retell webhook] retell_calls upsert ok for call_id:', call_id);
      }
    }

    // Forward payload to GHL on every event
    const ghlWebhookUrl = process.env.GHL_RETELL_WEBHOOK_URL;
    if (!ghlWebhookUrl) {
      console.error('[retell webhook] GHL_RETELL_WEBHOOK_URL is not set — skipping GHL forward');
    } else {
      const ghlBody = {
        // Top-level phone lets GHL match/create a contact on inbound webhook trigger
        phone,
        event: payload.event,
        call: {
          call_id,
          agent_id,
          call_status,
          caller_phone_number: phone,
          from_number: phone,
          to_number: payload.call?.to_number,
          start_timestamp,
          end_timestamp,
          transcript,
          call_summary,
          disconnection_reason,
          direction: payload.call?.direction,
        }
      };
      console.log('[retell webhook] sending to GHL url:', ghlWebhookUrl);
      console.log('[retell webhook] GHL body:', JSON.stringify(ghlBody));
      try {
        const ghlRes = await fetch(ghlWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ghlBody),
        });
        const ghlText = await ghlRes.text();
        console.log('[retell webhook] GHL status:', ghlRes.status, '| body:', ghlText);
      } catch (ghlErr) {
        console.error('[retell webhook] GHL fetch error:', ghlErr.message);
      }
    }

    // Missed-call SMS + missed_calls log
    const missedReasons = ['no_answer', 'voicemail'];
    const isMissed = missedReasons.includes(disconnection_reason);
    let textSent = false;

    if (isMissed && phone) {
      await sendSMS(
        phone,
        "Hey! Sorry we missed your call at TheHypeBox. We'd love to help — reply here or visit thehypeboxllc.com to chat with Alex!"
      );
      textSent = true;
    }

    await supabase.from('missed_calls').insert({
      call_id:    call_id || null,
      from_number: phone,
      timestamp:  start_timestamp ? new Date(start_timestamp).toISOString() : new Date().toISOString(),
      text_sent:  textSent,
    });

    return NextResponse.json({ ok: true, text_sent: textSent });
  } catch (error) {
    console.error('[retell webhook]', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
