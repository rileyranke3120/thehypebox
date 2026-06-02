import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { sendEmail } from '@/lib/send-email';
import { monthlyClientReportEmail } from '@/lib/email-templates';
import { getOpportunities, getContacts } from '@/lib/ghl';
import { safeCompare } from '@/lib/safe-compare';

export const dynamic = 'force-dynamic';

// ── Helpers ───────────────────────────────────────────────────

function prevMonthRange() {
  const now = new Date();
  const year = now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
  const month = now.getUTCMonth() === 0 ? 11 : now.getUTCMonth() - 1; // 0-indexed
  const start = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  const end   = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0)); // exclusive
  const label = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return { start, end, label };
}

async function fetchRetellStats(supabase, agentId, startIso, endIso) {
  if (!agentId) return { totalCalls: 0, appointmentsBooked: 0 };
  const { data } = await supabase
    .from('retell_calls')
    .select('call_summary')
    .eq('agent_id', agentId)
    .gte('start_timestamp', startIso)
    .lt('start_timestamp', endIso);

  const calls = data ?? [];
  const booked = calls.filter((c) => {
    const s = (c.call_summary ?? '').toLowerCase();
    return s.includes('appointment') || s.includes('booked') || s.includes('scheduled');
  }).length;

  return { totalCalls: calls.length, appointmentsBooked: booked };
}

async function fetchMissedCalls(supabase, clientId, startIso, endIso) {
  const { data } = await supabase
    .from('missed_calls')
    .select('id')
    .eq('client_id', clientId)
    .gte('timestamp', startIso)
    .lt('timestamp', endIso);
  return (data ?? []).length;
}

async function fetchGhlStats(locationId, apiKey, startMs, endMs) {
  let pipelineValue = null;
  let newContacts = null;

  try {
    const opps = await getOpportunities(locationId, apiKey);
    pipelineValue = opps.reduce((sum, o) => {
      const v = parseFloat(o.monetaryValue ?? o.value ?? 0);
      return sum + (isNaN(v) ? 0 : v);
    }, 0);
  } catch (err) {
    console.warn(`[monthly-report] GHL opportunities fetch failed for ${locationId}:`, err.message);
  }

  try {
    const contacts = await getContacts(locationId, apiKey);
    newContacts = contacts.filter((c) => {
      const added = c.dateAdded ? new Date(c.dateAdded).getTime() : 0;
      return added >= startMs && added < endMs;
    }).length;
  } catch (err) {
    console.warn(`[monthly-report] GHL contacts fetch failed for ${locationId}:`, err.message);
  }

  return { pipelineValue, newContacts };
}

// ── Route ─────────────────────────────────────────────────────

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET) {
    console.error('[cron] CRON_SECRET env var is not set');
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 });
  }
  if (!safeCompare(authHeader ?? '', `Bearer ${process.env.CRON_SECRET ?? ''}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { start, end, label } = prevMonthRange();
  const startIso = start.toISOString();
  const endIso   = end.toISOString();
  const startMs  = start.getTime();
  const endMs    = end.getTime();

  const supabase = createClient();

  const { data: clients, error } = await supabase
    .from('users')
    .select('id, name, email, business_name, plan, plan_status, retell_agent_id, ghl_location_id, ghl_api_key')
    .in('plan_status', ['active', 'trialing'])
    .not('email', 'is', null);

  if (error) {
    console.error('[monthly-report] failed to fetch clients:', error.message);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }

  const results = await Promise.all(
    (clients ?? []).map(async (client) => {
      try {
        const [retellStats, missedCount, ghlStats] = await Promise.all([
          fetchRetellStats(supabase, client.retell_agent_id, startIso, endIso),
          fetchMissedCalls(supabase, client.id, startIso, endIso),
          (client.ghl_location_id && client.ghl_api_key)
            ? fetchGhlStats(client.ghl_location_id, client.ghl_api_key, startMs, endMs)
            : Promise.resolve({ pipelineValue: null, newContacts: null }),
        ]);

        const tpl = monthlyClientReportEmail({
          name:               client.name,
          businessName:       client.business_name,
          monthLabel:         label,
          totalCalls:         retellStats.totalCalls,
          appointmentsBooked: retellStats.appointmentsBooked,
          missedCalls:        missedCount,
          pipelineValue:      ghlStats.pipelineValue,
          newContacts:        ghlStats.newContacts,
        });

        await sendEmail({ to: client.email, ...tpl });
        console.log(`[monthly-report] sent to ${client.email}`);
        return { email: client.email, ok: true };
      } catch (err) {
        console.error(`[monthly-report] failed for ${client.email}:`, err.message);
        return { email: client.email, ok: false, error: err.message };
      }
    })
  );

  const sent    = results.filter((r) => r.ok).length;
  const failed  = results.filter((r) => !r.ok).length;
  console.log(`[monthly-report] done — ${sent} sent, ${failed} failed`);

  return NextResponse.json({ ok: true, month: label, sent, failed, results });
}
