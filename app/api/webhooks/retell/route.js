import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { sendSMS } from '@/lib/twilio';
import { findContactByPhone, createContact, addContactNote } from '@/lib/ghl';
import crypto from 'crypto';

function verifyRetellSignature(rawBody, signature, apiKey) {
  if (!signature || !apiKey) return false;
  const expected = crypto.createHmac('sha256', apiKey).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  } catch { return false; }
}

export async function POST(request) {
  const rawBody = await request.text();
  const apiKey = process.env.RETELL_API_KEY;
  const signature = request.headers.get('x-retell-signature');
  if (!verifyRetellSignature(rawBody, signature, apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
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
    //
    // isNewCall is checked BEFORE the upsert so we can gate downstream side-effects
    // (missed-call SMS, missed_calls insert) on first-time processing only.
    // On Retell webhook retries the upsert is idempotent; SMS and DB inserts are not.
    let isNewCall = false;
    if (event === 'call_analyzed' || call_status === 'ended') {
      if (call_id) {
        const { data: priorCall } = await supabase
          .from('retell_calls')
          .select('call_id')
          .eq('call_id', call_id)
          .maybeSingle();
        isNewCall = !priorCall;
      } else {
        isNewCall = false; // can't deduplicate without call_id — skip all side effects
      }

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
    const GHL_VALID_URL_PREFIX = 'https://services.leadconnectorhq.com/';
    if (!ghlWebhookUrl) {
      console.error('[retell webhook] GHL_RETELL_WEBHOOK_URL is not set — skipping GHL forward');
    } else if (!ghlWebhookUrl.startsWith(GHL_VALID_URL_PREFIX)) {
      console.error('[retell webhook] GHL_RETELL_WEBHOOK_URL is not a valid leadconnectorhq.com URL — skipping forward');
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

    // Look up client by agent_id — needed for branding, SMS credentials, and client_id on the log
    let clientRow = null;
    if (agent_id) {
      const { data } = await supabase
        .from('users')
        .select('id, business_name, ghl_api_key, ghl_location_id')
        .eq('retell_agent_id', agent_id)
        .single();
      clientRow = data || null;
    }

    // Missed-call SMS + missed_calls log
    const missedReasons = ['no_answer', 'voicemail'];
    const isMissed = missedReasons.includes(disconnection_reason);
    let textSent = false;

    // Only send missed-call SMS on first-time processing — not on Retell webhook retries.
    // isNewCall is set above based on whether call_id already existed in retell_calls.
    if (isMissed && phone && isNewCall) {
      if (!clientRow?.ghl_api_key || !clientRow?.ghl_location_id) {
        console.warn('[retell webhook] no GHL credentials for client, skipping missed-call SMS');
      } else {
        const businessName = clientRow.business_name || 'our team';
        await sendSMS(
          phone,
          `Hi! Sorry we missed your call at ${businessName}. How can we help? Reply here and we'll get right back to you!`,
          { apiKey: clientRow.ghl_api_key, locationId: clientRow.ghl_location_id }
        );
        textSent = true;
      }
    }

    if (isMissed && call_id) {
      // Upsert on call_id so Retell webhook retries don't create duplicate missed_calls rows.
      // Requires a unique constraint on missed_calls.call_id.
      // Skipped when call_id is null — NULL != NULL in Postgres unique constraints, so dedup doesn't work.
      const { error: missedUpsertErr } = await supabase.from('missed_calls').upsert({
        call_id,
        from_number:   phone,
        business_name: clientRow?.business_name || null,
        client_id:     clientRow?.id || null,
        timestamp:     start_timestamp ? new Date(start_timestamp).toISOString() : new Date().toISOString(),
        text_sent:     textSent,
      }, { onConflict: 'call_id', ignoreDuplicates: true });
      if (missedUpsertErr) {
        console.error('[retell webhook] missed_calls upsert error:', missedUpsertErr.message);
      }
    }

    // For completed calls with a summary, create/update the GHL contact and log the call.
    // Gated on isNewCall so webhook retries don't append duplicate notes to the GHL contact.
    if (
      isNewCall &&
      (event === 'call_analyzed' || call_status === 'ended') &&
      phone &&
      call_summary &&
      clientRow?.ghl_api_key &&
      clientRow?.ghl_location_id
    ) {
      try {
        let contactId = await findContactByPhone(clientRow.ghl_location_id, phone, clientRow.ghl_api_key);
        if (!contactId) {
          contactId = await createContact(clientRow.ghl_location_id, { phone }, clientRow.ghl_api_key);
        }
        if (contactId) {
          const durationSec = start_timestamp && end_timestamp
            ? Math.round((new Date(end_timestamp) - new Date(start_timestamp)) / 1000)
            : null;
          const durationStr = durationSec ? `${Math.floor(durationSec / 60)}m ${durationSec % 60}s` : 'unknown duration';
          const noteBody = `📞 AI Call (${durationStr})\n\n${call_summary}`;
          await addContactNote(contactId, noteBody, clientRow.ghl_api_key);
        }
      } catch (ghlErr) {
        console.error('[retell webhook] GHL contact sync error:', ghlErr.message);
      }
    }

    return NextResponse.json({ ok: true, text_sent: textSent });
  } catch (error) {
    console.error('[retell webhook]', error);
    return NextResponse.json({ ok: false, error: 'Something went wrong.' }, { status: 500 });
  }
}
