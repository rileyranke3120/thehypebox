/**
 * POST /api/retell/check-availability
 *
 * Accepts: { date: string } — raw natural language from the caller,
 * e.g. "this Thursday", "April 28th", "next Monday", or "2026-04-28".
 * Parsed server-side using chrono-node with today's Eastern date as reference.
 *
 * Client credentials are resolved by agent_id (from Retell's call payload).
 * Fails closed — unknown agent_id returns an error, no fallback credentials.
 *
 * Returns: { slots: ["10:00 AM", "11:30 AM", ...] }
 */

import * as chrono from 'chrono-node';
import { createClient } from '@/lib/supabase';

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_API_VERSION = '2021-07-28';

// Look up a client's GHL credentials by their Retell agent_id
async function getClientCreds(agentId) {
  if (!agentId) return null;
  const supabase = createClient();
  const { data } = await supabase
    .from('users')
    .select('ghl_api_key, ghl_location_id, ghl_calendar_id')
    .eq('retell_agent_id', agentId)
    .single();
  return data || null;
}

// Fail closed — returns null if clientCreds is null (unknown agent_id)
function resolveGhlCreds(clientCreds) {
  if (!clientCreds) return null;
  return {
    apiKey:     clientCreds.ghl_api_key,
    locationId: clientCreds.ghl_location_id,
    calendarId: clientCreds.ghl_calendar_id,
  };
}

function ghlHeaders(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    Version: GHL_API_VERSION,
  };
}

// GHL slots come back as ISO strings like "2026-04-28T09:00:00-04:00"
function formatSlot(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/New_York',
  });
}

// Returns epoch ms for Eastern midnight on dateStr (handles EDT and EST automatically)
function easternMidnightMs(dateStr) {
  const noonUtc = new Date(`${dateStr}T12:00:00Z`);
  const easternHour = parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      hour12: false,
    }).format(noonUtc),
    10
  );
  const offsetHours = easternHour - 12;
  return new Date(`${dateStr}T00:00:00Z`).getTime() - offsetHours * 3_600_000;
}

// Parse a raw natural language date string into "YYYY-MM-DD"
function parseDate(raw) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const ref = new Date(
    new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) + 'T00:00:00'
  );
  const parsed = chrono.parseDate(raw, ref, { forwardDate: true });
  if (!parsed) throw new Error(`Could not understand date: "${raw}"`);
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const d = String(parsed.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function POST(request) {
  const secret = process.env.RETELL_TOOL_SECRET;
  if (!secret || request.headers.get('x-api-key') !== secret) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Resolve GHL credentials by agent_id — fail closed if unknown
  const agentId = body.agent_id ?? null;
  const clientCreds = await getClientCreds(agentId);
  const creds = resolveGhlCreds(clientCreds);

  if (!creds || !creds.apiKey || !creds.locationId) {
    console.error(`[check-availability] no credentials for agent_id=${agentId}`);
    return Response.json({ error: "This agent isn't configured for booking. Please call us directly." }, { status: 503 });
  }

  if (!creds.calendarId) {
    console.error('[check-availability] no calendarId — client has no ghl_calendar_id set');
    return Response.json({ error: "Booking isn't configured for this account yet." }, { status: 503 });
  }

  // Retell wraps tool arguments in body.args; fall back to body itself for direct testing
  const args = body.args ?? body;
  const { date: rawDate } = args;
  if (!rawDate) {
    return Response.json({ error: 'date is required' }, { status: 400 });
  }
  if (rawDate.length > 200) {
    return Response.json({ error: "I couldn't understand that date. Please try a clear date like 'next Tuesday' or 'May 25th'." }, { status: 422 });
  }

  let date;
  try {
    date = parseDate(rawDate);
  } catch {
    return Response.json({ error: "I couldn't understand that date. Please try a clear date like 'next Tuesday' or 'May 25th'." }, { status: 422 });
  }

  const startMs = easternMidnightMs(date);
  const endMs = startMs + 24 * 3_600_000 - 1;

  const url = `${GHL_API_BASE}/calendars/${creds.calendarId}/free-slots?startDate=${startMs}&endDate=${endMs}&timezone=America%2FNew_York`;

  try {
    const res = await fetch(url, { headers: ghlHeaders(creds.apiKey) });
    const raw = await res.json();

    if (!res.ok) {
      console.error(`[check-availability] GHL error status=${res.status}`);
      return Response.json({ error: 'Failed to fetch availability. Please try again.' }, { status: 502 });
    }

    const dateKeys = Object.keys(raw).filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k));
    const dateKey = dateKeys.find((k) => k === date) ?? dateKeys[0];
    const slots = dateKey ? (raw[dateKey]?.slots ?? []) : [];
    const formatted = slots.map(formatSlot);

    return Response.json({
      date,
      slots: formatted,
      count: formatted.length,
      message: formatted.length > 0
        ? `Available times on ${date}: ${formatted.join(', ')}`
        : `No available slots on ${date}`,
    });
  } catch (err) {
    console.error('[check-availability] Error:', err.message);
    return Response.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
