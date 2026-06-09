import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { sendEmail } from '@/lib/send-email';
import { sendSMS } from '@/lib/twilio';
import { monthlyClientReportEmail } from '@/lib/email-templates';
import { getOpportunities, getContacts, getAppointments } from '@/lib/ghl';
import { safeCompare } from '@/lib/safe-compare';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// ── Helpers ───────────────────────────────────────────────────

function prevMonthRange() {
  const now = new Date();
  const year = now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
  const month = now.getUTCMonth() === 0 ? 11 : now.getUTCMonth() - 1;
  const start = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  const end   = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0));
  const label = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return { start, end, label };
}

async function fetchRetellStats(supabase, agentId, startIso, endIso) {
  if (!agentId) return { totalCalls: 0, retellBooked: 0 };
  const { data } = await supabase
    .from('retell_calls')
    .select('call_summary')
    .eq('agent_id', agentId)
    .gte('start_timestamp', startIso)
    .lt('start_timestamp', endIso);

  const calls = data ?? [];
  const retellBooked = calls.filter((c) => {
    const s = (c.call_summary ?? '').toLowerCase();
    return s.includes('appointment') || s.includes('booked') || s.includes('scheduled');
  }).length;

  return { totalCalls: calls.length, retellBooked };
}

async function fetchMissedTextbacks(supabase, clientId, startIso, endIso) {
  const { data } = await supabase
    .from('missed_calls')
    .select('id')
    .eq('client_id', clientId)
    .gte('timestamp', startIso)
    .lt('timestamp', endIso);
  return (data ?? []).length;
}

async function fetchGhlStats(locationId, apiKey, startMs, endMs, startIso, endIso) {
  let pipelineValue = 0;
  let leadsCapt = 0;
  let ghlAppts = 0;

  await Promise.allSettled([
    getOpportunities(locationId, apiKey)
      .then((opps) => {
        pipelineValue = opps.reduce((sum, o) => {
          const v = parseFloat(o.monetaryValue ?? o.value ?? 0);
          return sum + (isNaN(v) ? 0 : v);
        }, 0);
      })
      .catch((err) => console.warn(`[monthly-report] GHL opps failed (${locationId}):`, err.message)),

    getContacts(locationId, apiKey)
      .then((contacts) => {
        leadsCapt = contacts.filter((c) => {
          const added = c.dateAdded ? new Date(c.dateAdded).getTime() : 0;
          return added >= startMs && added < endMs;
        }).length;
      })
      .catch((err) => console.warn(`[monthly-report] GHL contacts failed (${locationId}):`, err.message)),

    getAppointments(locationId, startIso, endIso, apiKey)
      .then((events) => { ghlAppts = events.length; })
      .catch((err) => console.warn(`[monthly-report] GHL appts failed (${locationId}):`, err.message)),
  ]);

  return { pipelineValue, leadsCapt, ghlAppts };
}

async function generateNarrative(client, stats, monthLabel) {
  const { totalCalls, apptsFinal, leadsCapt, pipelineValue, missedTextbacks } = stats;
  const firstName = (client.name || '').split(' ')[0] || 'there';
  const biz = client.business_name || 'your business';

  const prompt = `You are writing a monthly performance report for a local business owner who uses TheHypeBox AI automation platform.

Client: ${firstName} at ${biz}
Month: ${monthLabel}

Performance data:
- Total calls handled by Sarah (AI receptionist): ${totalCalls}
- Appointments booked: ${apptsFinal}
- New leads captured: ${leadsCapt}
- Active pipeline value: $${Number(pipelineValue).toLocaleString()}
- Missed call text backs sent automatically: ${missedTextbacks}

Write a warm, professional performance summary for this business owner. Structure it as three short paragraphs:
1. A personalized opening acknowledging their month's performance (2-3 sentences)
2. Key highlights — what the AI system did well for them specifically
3. A brief forward-looking sentence with encouragement

Plain text only. No bullet points, no markdown, no headers. Sound like a knowledgeable advisor. Under 250 words.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const result = await res.json();
  return result.content?.[0]?.text?.trim() ?? '';
}

// ── Route ─────────────────────────────────────────────────────

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET) {
    console.error('[monthly-report] CRON_SECRET not set');
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 });
  }
  if (!safeCompare(authHeader ?? '', `Bearer ${process.env.CRON_SECRET ?? ''}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { start, end, label } = prevMonthRange();
  const startIso  = start.toISOString();
  const endIso    = end.toISOString();
  const startMs   = start.getTime();
  const endMs     = end.getTime();
  const monthStart = startIso.split('T')[0];

  const supabase = createClient();

  const { data: rawClients, error } = await supabase
    .from('users')
    .select('id, name, email, business_name, phone, business_phone, plan, plan_status, role, retell_agent_id, ghl_location_id, ghl_api_key')
    .in('plan_status', ['active', 'trialing'])
    .not('email', 'is', null);

  if (error) {
    console.error('[monthly-report] DB fetch failed:', error.message);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }

  const clients = (rawClients ?? []).filter((u) => u.role !== 'super_admin');

  if (clients.length === 0) {
    console.log('[monthly-report] no eligible clients');
    return NextResponse.json({ ok: true, month: label, sent: 0, failed: 0, results: [] });
  }

  const mainApiKey    = process.env.GHL_API_KEY;
  const mainLocationId = process.env.GHL_LOCATION_ID;

  const settled = await Promise.allSettled(
    clients.map(async (client) => {
      let totalCalls      = 0;
      let retellBooked    = 0;
      let missedTextbacks = 0;
      let pipelineValue   = 0;
      let leadsCapt       = 0;
      let ghlAppts        = 0;
      let narrative       = '';
      let emailSent       = false;
      let smsSent         = false;
      let errorMsg        = null;

      try {
        const [retellStats, missed, ghlStats] = await Promise.all([
          fetchRetellStats(supabase, client.retell_agent_id, startIso, endIso),
          fetchMissedTextbacks(supabase, client.id, startIso, endIso),
          (client.ghl_location_id && client.ghl_api_key)
            ? fetchGhlStats(client.ghl_location_id, client.ghl_api_key, startMs, endMs, startIso, endIso)
            : Promise.resolve({ pipelineValue: 0, leadsCapt: 0, ghlAppts: 0 }),
        ]);

        totalCalls      = retellStats.totalCalls;
        retellBooked    = retellStats.retellBooked;
        missedTextbacks = missed;
        pipelineValue   = ghlStats.pipelineValue;
        leadsCapt       = ghlStats.leadsCapt;
        ghlAppts        = ghlStats.ghlAppts;

        // Prefer GHL calendar count; fall back to retell keyword detection
        const apptsFinal = ghlAppts > 0 ? ghlAppts : retellBooked;

        // Claude-written narrative
        if (process.env.ANTHROPIC_API_KEY) {
          try {
            narrative = await generateNarrative(
              client,
              { totalCalls, apptsFinal, leadsCapt, pipelineValue, missedTextbacks },
              label
            );
          } catch (err) {
            console.warn(`[monthly-report] narrative failed for ${client.email}:`, err.message);
          }
        }

        // Send email
        const apptsFinalForEmail = ghlAppts > 0 ? ghlAppts : retellBooked;
        const tpl = monthlyClientReportEmail({
          name:               client.name,
          businessName:       client.business_name,
          monthLabel:         label,
          totalCalls,
          appointmentsBooked: apptsFinalForEmail,
          missedCalls:        missedTextbacks,
          pipelineValue,
          newContacts:        leadsCapt,
          narrative,
        });
        await sendEmail({ to: client.email, ...tpl });
        emailSent = true;
        console.log(`[monthly-report] email → ${client.email}`);

        // SMS summary to client
        const clientPhone = client.phone || client.business_phone;
        if (clientPhone && mainApiKey && mainLocationId) {
          try {
            const smsBody = `${label} Report — Sarah handled ${totalCalls} calls, booked ${apptsFinalForEmail} appointments, and your pipeline sits at $${Number(pipelineValue).toLocaleString()}. Full report sent to your email. — Riley @ TheHypeBox`;
            await sendSMS(clientPhone, smsBody, { apiKey: mainApiKey, locationId: mainLocationId });
            smsSent = true;
            console.log(`[monthly-report] SMS → ${clientPhone}`);
          } catch (err) {
            console.warn(`[monthly-report] SMS failed for ${client.email}:`, err.message);
          }
        }
      } catch (err) {
        errorMsg = err.message;
        console.error(`[monthly-report] failed for ${client.email}:`, err.message);
      }

      // Log to Supabase (upsert so re-runs are safe)
      const apptsFinalLog = ghlAppts > 0 ? ghlAppts : retellBooked;
      const { error: logErr } = await supabase.from('monthly_reports').upsert(
        {
          user_id:          client.id,
          client_email:     client.email,
          client_name:      client.name,
          business_name:    client.business_name,
          month_label:      label,
          month_start:      monthStart,
          total_calls:      totalCalls,
          leads_captured:   leadsCapt,
          pipeline_value:   pipelineValue,
          appts_booked:     apptsFinalLog,
          missed_textbacks: missedTextbacks,
          report_text:      narrative,
          email_sent:       emailSent,
          sms_sent:         smsSent,
          error:            errorMsg,
          created_at:       new Date().toISOString(),
        },
        { onConflict: 'user_id,month_start' }
      );
      if (logErr) console.warn(`[monthly-report] log failed (${client.email}):`, logErr.message);

      return { email: client.email, ok: !errorMsg, emailSent, smsSent, error: errorMsg };
    })
  );

  const results = settled.map((r) =>
    r.status === 'fulfilled' ? r.value : { ok: false, error: r.reason?.message }
  );
  const sent   = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  console.log(`[monthly-report] done — ${sent} sent, ${failed} failed (${label})`);
  return NextResponse.json({ ok: true, month: label, sent, failed, results });
}
