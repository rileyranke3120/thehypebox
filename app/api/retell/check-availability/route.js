import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { parseDate } from '@/lib/parseDate';
import { getCalendarFreeSlots } from '@/lib/ghl';

// Look up GHL credentials by Retell agent_id; falls back to env vars (agency defaults)
async function resolveCredentials(agentId) {
  const supabase = createClient();
  const { data } = await supabase
    .from('users')
    .select('ghl_api_key, ghl_location_id')
    .eq('retell_agent_id', agentId)
    .maybeSingle();

  return {
    apiKey:     data?.ghl_api_key     || process.env.GHL_DAVE_API_KEY,
    locationId: data?.ghl_location_id || process.env.GHL_DAVE_LOCATION_ID,
    calendarId: process.env.GHL_DAVE_CALENDAR_ID,
  };
}

// Format a UTC ISO slot start time into a readable "10:00 AM" style label
function formatSlotTime(isoString) {
  const d = new Date(isoString);
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/New_York',
  });
}

export async function POST(request) {
  console.log('RETELL HIT - check-availability');
  try {
    const body = await request.json();
    console.log('[check-availability] FULL BODY:', JSON.stringify(body));
    console.log('[check-availability] TOP-LEVEL KEYS:', Object.keys(body));
    console.log('[check-availability] body.arguments:', JSON.stringify(body.arguments));
    console.log('[check-availability] body.args:', JSON.stringify(body.args));
    console.log('[check-availability] body.date:', body.date);
    console.log('[check-availability] body.input:', JSON.stringify(body.input));
    console.log('[check-availability] body.arguments?.date:', body.arguments?.date);
    console.log('[check-availability] body.args?.date:', body.args?.date);

    // Real Retell calls send { call, name, args } — curl/legacy tests send { arguments }
    const args = body.args
      ?? (typeof body.arguments === 'string' ? JSON.parse(body.arguments) : (body.arguments ?? {}));

    const rawDate = args.date;
    const agentId = body.call?.agent_id ?? body.agent_id;
    const parsedDate = parseDate(rawDate);
    console.log('RAW DATE RECEIVED:', rawDate);
    console.log('PARSED DATE:', parsedDate);

    if (!rawDate) {
      return NextResponse.json({ result: "I didn't catch the date. Could you say it again?" });
    }

    const dateYMD = parsedDate;
    if (!dateYMD) {
      return NextResponse.json({
        result: `I wasn't able to understand "${rawDate}" as a date. Could you try saying it like "April 24th" or "4/24"?`,
      });
    }

    const { apiKey, calendarId } = await resolveCredentials(agentId);
    if (!apiKey || !calendarId) {
      console.error('[check-availability] Missing GHL_API_KEY or GHL_CALENDAR_ID env vars');
      return NextResponse.json({ result: 'Our scheduling system is temporarily unavailable. Please call back or visit our website to book.' });
    }

    const slots = await getCalendarFreeSlots(calendarId, dateYMD, apiKey);

    if (!slots.length) {
      return NextResponse.json({
        result: `We don't have any open slots on ${rawDate}. Would you like to check a different day?`,
      });
    }

    const timeLabels = slots.slice(0, 6).map(s => formatSlotTime(s.startTime)).join(', ');
    return NextResponse.json({
      result: `We have availability on ${rawDate} at the following times: ${timeLabels}. Which works best for you?`,
    });

  } catch (err) {
    console.error('[check-availability]', err);
    return NextResponse.json({ result: 'Something went wrong checking availability. Please try again.' });
  }
}
