import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { sendSMS } from '@/lib/twilio';

async function logError(agent, err) {
  try {
    const supabase = createClient();
    await supabase.from('error_log').insert({
      agent,
      error_message: (err.message || String(err)).slice(0, 500),
      stack:         err.stack?.slice(0, 2000) ?? null,
      occurred_at:   new Date().toISOString(),
    });
  } catch (e) {
    console.error('[error-monitor] DB log failed:', e.message);
  }
}

async function getRecentErrorCount(agent) {
  try {
    const supabase = createClient();
    const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('error_log')
      .select('id', { count: 'exact', head: true })
      .eq('agent', agent)
      .gte('occurred_at', since);
    return count ?? 0;
  } catch {
    return 0;
  }
}

async function sendAlert(agent, err, count) {
  const phone      = process.env.RILEY_PHONE;
  const apiKey     = process.env.GHL_LOCATION_KEY;
  const locationId = process.env.GHL_LOCATION_ID;

  if (!phone || !apiKey || !locationId) {
    console.warn('[error-monitor] RILEY_PHONE/GHL_LOCATION_KEY/GHL_LOCATION_ID not set — skipping SMS');
    return;
  }

  const time    = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'short', timeStyle: 'short' });
  const preview = (err.message || String(err)).slice(0, 120);

  const msg = count >= 3
    ? `URGENT: ${agent} has failed ${count}x in 6h\n${preview}\n${time}`
    : `Agent error: ${agent}\n${preview}\n${time}`;

  try {
    await sendSMS(phone, msg, { apiKey, locationId });
  } catch (e) {
    console.error('[error-monitor] SMS send failed:', e.message);
  }
}

export function withErrorMonitor(agentName, handler) {
  return async function wrappedHandler(request, ctx) {
    try {
      return await handler(request, ctx);
    } catch (err) {
      console.error(`[${agentName}] unhandled error:`, err);
      await logError(agentName, err);
      const count = await getRecentErrorCount(agentName);
      // Alert on first failure and again on every 3rd (3, 6, 9…)
      if (count === 1 || count % 3 === 0) {
        await sendAlert(agentName, err, count);
      }
      return NextResponse.json(
        { error: 'Internal server error', agent: agentName },
        { status: 500 }
      );
    }
  };
}
