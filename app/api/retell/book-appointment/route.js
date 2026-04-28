import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { parseDate, parseTime } from '@/lib/parseDate';
import { findContactByPhone, createContact, createGhlAppointment } from '@/lib/ghl';

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

// Build ISO start/end strings from YYYY-MM-DD + HH:MM, duration in minutes
function buildIso(dateYMD, timeHHMM, durationMins = 30) {
  const [year, month, day] = dateYMD.split('-').map(Number);
  const [hours, mins] = timeHHMM.split(':').map(Number);
  const start = new Date(Date.UTC(year, month - 1, day, hours, mins, 0));
  // Shift from Eastern to UTC (ET is UTC-5 standard / UTC-4 daylight)
  // GHL accepts local ISO strings — pass through without zone conversion so
  // GHL interprets the time in the location's configured timezone.
  const startIso = `${dateYMD}T${timeHHMM}:00`;
  const end = new Date(start.getTime() + durationMins * 60 * 1000);
  const endH = String(end.getUTCHours()).padStart(2, '0');
  const endM = String(end.getUTCMinutes()).padStart(2, '0');
  const endIso = `${dateYMD}T${endH}:${endM}:00`;
  return { startIso, endIso };
}

export async function POST(request) {
  console.log('RETELL HIT - book-appointment');
  try {
    const body = await request.json();
    console.log('[book-appointment] FULL BODY:', JSON.stringify(body));
    console.log('[book-appointment] TOP-LEVEL KEYS:', Object.keys(body));
    console.log('[book-appointment] body.arguments:', JSON.stringify(body.arguments));
    console.log('[book-appointment] body.args:', JSON.stringify(body.args));
    console.log('[book-appointment] body.date:', body.date);
    console.log('[book-appointment] body.input:', JSON.stringify(body.input));
    console.log('[book-appointment] body.arguments?.date:', body.arguments?.date);
    console.log('[book-appointment] body.args?.date:', body.args?.date);

    // Real Retell calls send { call, name, args } — curl/legacy tests send { arguments }
    const args = body.args
      ?? (typeof body.arguments === 'string' ? JSON.parse(body.arguments) : (body.arguments ?? {}));

    const { date: rawDate, time: rawTime, name: callerName, phone: callerPhone } = args;
    const agentId  = body.call?.agent_id ?? body.agent_id;
    const callId   = body.call?.call_id  ?? body.call_id;

    const parsedDate = parseDate(rawDate);
    console.log('RAW DATE RECEIVED:', rawDate);
    console.log('PARSED DATE:', parsedDate);

    // --- Validate and parse date ---
    if (!rawDate) {
      return NextResponse.json({ result: "I didn't catch the date. What day works for you?" });
    }
    const dateYMD = parsedDate;
    if (!dateYMD) {
      return NextResponse.json({
        result: `I couldn't understand "${rawDate}" as a date. Could you say it like "April 24th" or "4/24"?`,
      });
    }

    // --- Validate and parse time ---
    if (!rawTime) {
      return NextResponse.json({ result: "What time would you like the appointment?" });
    }
    const timeHHMM = parseTime(rawTime);
    if (!timeHHMM) {
      return NextResponse.json({
        result: `I didn't catch the time. Could you say something like "10am" or "2:30pm"?`,
      });
    }

    const { apiKey, locationId, calendarId } = await resolveCredentials(agentId);
    if (!apiKey || !locationId || !calendarId) {
      console.error('[book-appointment] Missing GHL credentials or GHL_CALENDAR_ID env var');
      return NextResponse.json({ result: 'Our booking system is temporarily unavailable. Please call back or visit our website.' });
    }

    // --- Find or create GHL contact ---
    let contactId = null;
    const phone = callerPhone || body.call?.caller_phone_number || null;

    if (phone) {
      contactId = await findContactByPhone(locationId, phone, apiKey);
      if (!contactId) {
        contactId = await createContact(locationId, { name: callerName, phone }, apiKey);
      }
    }

    // --- Build appointment times ---
    const { startIso, endIso } = buildIso(dateYMD, timeHHMM);

    // --- Book via GHL ---
    await createGhlAppointment(
      {
        calendarId,
        locationId,
        contactId,
        startIso,
        endIso,
        title: callerName ? `Appointment — ${callerName}` : 'Phone Booking',
      },
      apiKey
    );

    // --- Mirror to Supabase appointments table ---
    try {
      const supabase = createClient();
      await supabase.from('appointments').insert({
        date:  dateYMD,
        time:  timeHHMM,
        title: callerName ? `Appointment — ${callerName}` : 'Phone Booking',
        notes: `Booked via AI call${callId ? ` (${callId})` : ''}`,
      });
    } catch (dbErr) {
      // Non-fatal — GHL is the source of truth for bookings
      console.warn('[book-appointment] Supabase mirror failed:', dbErr.message);
    }

    // Format a friendly confirmation time
    const [h, m] = timeHHMM.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
    const displayTime = `${displayH}:${String(m).padStart(2, '0')} ${period}`;

    return NextResponse.json({
      result: `You're all set! I've booked your appointment for ${rawDate} at ${displayTime}. You'll receive a confirmation shortly. Is there anything else I can help you with?`,
    });

  } catch (err) {
    console.error('[book-appointment]', err);
    return NextResponse.json({
      result: 'I ran into a problem booking that appointment. Please call back or visit our website and we can get you scheduled.',
    });
  }
}
