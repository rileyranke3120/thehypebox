/**
 * POST /api/retell/book-appointment
 *
 * Accepts: { name, phone, address, date, time, email (optional) }
 * date and time are raw natural language strings from the caller —
 * e.g. "this Thursday", "April 24th", "10am", "two o clock".
 * We parse them server-side using chrono-node with today's Eastern date as reference.
 *
 * - Parses natural language date/time
 * - Fetches GHL's actual available slots for that day
 * - Snaps the requested time to the nearest available slot (avoids "slot unavailable" errors)
 * - Searches GHL for existing contact by phone, creates if not found
 * - Books the snapped slot on the GHL calendar
 * Returns: { success, appointmentId, confirmation }
 */

import * as chrono from 'chrono-node';

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_API_VERSION = '2021-07-28';

function ghlHeaders() {
  return {
    Authorization: `Bearer ${process.env.GHL_DAVE_API_KEY}`,
    'Content-Type': 'application/json',
    Version: GHL_API_VERSION,
  };
}

// Normalize phone to E.164 format (+1XXXXXXXXXX)
function normalizePhone(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

// Returns today's date as a Date object anchored to Eastern midnight
function todayEastern() {
  const nowEastern = new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/New_York',
  }); // "YYYY-MM-DD"
  return new Date(`${nowEastern}T00:00:00`);
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
  const offsetHours = easternHour - 12; // e.g. -4 for EDT, -5 for EST
  return new Date(`${dateStr}T00:00:00Z`).getTime() - offsetHours * 3_600_000;
}

// Parse a raw natural language date string into "YYYY-MM-DD"
function parseDate(raw) {
  const ref = todayEastern();
  const parsed = chrono.parseDate(raw, ref, { forwardDate: true });
  if (!parsed) throw new Error(`Could not understand date: "${raw}"`);
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const d = String(parsed.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Parse a raw natural language time string and return epoch ms for comparison
function parseTimeMs(rawTime, dateStr) {
  const ref = todayEastern();
  const parsed = chrono.parseDate(`${dateStr} ${rawTime}`, ref, { forwardDate: true });
  if (!parsed) throw new Error(`Could not understand time: "${rawTime}"`);
  return parsed.getTime();
}

// Format a slot ISO string into a human-readable time for the confirmation message
function formatSlotTime(isoStr) {
  return new Date(isoStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/New_York',
  });
}

// Fetch available slots from GHL for a given date, return array of ISO strings
async function fetchSlots(dateStr) {
  const startMs = easternMidnightMs(dateStr);
  const endMs = startMs + 24 * 3_600_000 - 1;
  const calendarId = process.env.GHL_DAVE_CALENDAR_ID;
  const url = `${GHL_API_BASE}/calendars/${calendarId}/free-slots?startDate=${startMs}&endDate=${endMs}&timezone=America%2FNew_York`;

  console.log(`[book-appointment] fetching slots for ${dateStr}: ${url}`);

  const res = await fetch(url, { headers: ghlHeaders() });
  const raw = await res.json();

  console.log(`[book-appointment] GHL free-slots status=${res.status} response=${JSON.stringify(raw)}`);

  if (!res.ok) throw new Error(`Failed to fetch slots: ${JSON.stringify(raw)}`);

  const dateKeys = Object.keys(raw).filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k));
  const dateKey = dateKeys.find((k) => k === dateStr) ?? dateKeys[0];
  return dateKey ? (raw[dateKey]?.slots ?? []) : [];
}

// Snap requested time (as epoch ms) to the nearest available GHL slot ISO string
function snapToNearestSlot(requestedMs, slots) {
  if (slots.length === 0) return null;
  let best = slots[0];
  let bestDiff = Math.abs(new Date(slots[0]).getTime() - requestedMs);
  for (const slot of slots) {
    const diff = Math.abs(new Date(slot).getTime() - requestedMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = slot;
    }
  }
  return best;
}

async function findContactByPhone(phone) {
  const locationId = process.env.GHL_DAVE_LOCATION_ID;
  const res = await fetch(`${GHL_API_BASE}/contacts/search`, {
    method: 'POST',
    headers: ghlHeaders(),
    body: JSON.stringify({
      locationId,
      pageLimit: 1,
      filters: [{ field: 'phone', operator: 'eq', value: phone }],
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.contacts?.[0]?.id ?? null;
}

async function createContact({ name, phone, email, address }) {
  const locationId = process.env.GHL_DAVE_LOCATION_ID;
  const [firstName, ...rest] = (name || '').trim().split(' ');
  const lastName = rest.join(' ') || '';

  const body = {
    locationId,
    firstName,
    lastName,
    phone,
    ...(email ? { email } : {}),
    ...(address ? { address1: address } : {}),
  };

  const res = await fetch(`${GHL_API_BASE}/contacts/`, {
    method: 'POST',
    headers: ghlHeaders(),
    body: JSON.stringify(body),
  });

  const data = await res.json();

  // GHL rejects duplicate contacts but returns the existing contactId in meta
  if (!res.ok) {
    if (data?.meta?.contactId) {
      console.log(`[book-appointment] duplicate contact detected, reusing existing id: ${data.meta.contactId}`);
      return data.meta.contactId;
    }
    throw new Error(`Failed to create contact: ${JSON.stringify(data)}`);
  }

  return data.contact.id;
}

async function bookAppointment({ contactId, startTime }) {
  const body = {
    calendarId: process.env.GHL_DAVE_CALENDAR_ID,
    locationId: process.env.GHL_DAVE_LOCATION_ID,
    contactId,
    startTime,
    toNotify: true,
  };

  console.log('[book-appointment] booking payload:', JSON.stringify(body));

  const res = await fetch(`${GHL_API_BASE}/calendars/events/appointments`, {
    method: 'POST',
    headers: ghlHeaders(),
    body: JSON.stringify(body),
  });

  const data = await res.json();
  console.log(`[book-appointment] GHL status=${res.status} response=${JSON.stringify(data)}`);
  if (!res.ok) throw new Error(`Failed to book appointment: ${JSON.stringify(data)}`);
  return data;
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Log full raw body first so we can see exactly what Retell is sending
  console.log('[book-appointment] raw body:', JSON.stringify(body));

  // Retell wraps tool arguments in body.args; fall back to body itself for direct testing
  const args = body.args ?? body;
  const { name, phone, email, address, date: rawDate, time: rawTime } = args;

  if (!name || !phone || !address || !rawDate || !rawTime) {
    console.log(`[book-appointment] missing fields — name=${name} phone=${phone} address=${address} date=${rawDate} time=${rawTime}`);
    return Response.json(
      { error: 'name, phone, address, date, and time are required' },
      { status: 400 }
    );
  }

  console.log(`[book-appointment] raw input — date="${rawDate}" time="${rawTime}"`);

  // Parse natural language date and requested time
  let dateStr, requestedMs;
  try {
    dateStr = parseDate(rawDate);
    requestedMs = parseTimeMs(rawTime, dateStr);
  } catch (err) {
    console.error('[book-appointment] parse error:', err.message);
    return Response.json({ error: err.message }, { status: 422 });
  }

  console.log(`[book-appointment] parsed date="${dateStr}" requestedMs=${requestedMs} (${new Date(requestedMs).toISOString()})`);

  // Fetch GHL's actual slots and snap to the nearest one
  let startTime;
  try {
    const slots = await fetchSlots(dateStr);
    console.log(`[book-appointment] available slots: ${JSON.stringify(slots)}`);

    if (slots.length === 0) {
      return Response.json(
        { error: `No available slots on ${dateStr}. Please ask the caller to choose a different date.` },
        { status: 409 }
      );
    }

    startTime = snapToNearestSlot(requestedMs, slots);
    console.log(`[book-appointment] snapped to slot: ${startTime}`);
  } catch (err) {
    console.error('[book-appointment] slot fetch error:', err.message);
    return Response.json({ error: String(err) }, { status: 502 });
  }

  const normalizedPhone = normalizePhone(phone);
  const confirmedTime = formatSlotTime(startTime);

  try {
    let contactId = await findContactByPhone(normalizedPhone);
    if (!contactId) {
      console.log(`[book-appointment] creating contact for ${normalizedPhone}`);
      contactId = await createContact({ name, phone: normalizedPhone, email, address });
    } else {
      console.log(`[book-appointment] found existing contact ${contactId}`);
    }

    const appointment = await bookAppointment({ contactId, startTime });
    const appointmentId = appointment.id ?? appointment.appointmentId ?? appointment._id;

    console.log(`[book-appointment] success — appointmentId=${appointmentId} for ${name} on ${dateStr} at ${confirmedTime}`);

    return Response.json({
      success: true,
      appointmentId,
      contactId,
      confirmation: `Got it! I've booked your appointment for ${dateStr} at ${confirmedTime}. You'll receive a confirmation shortly.`,
      details: { name, phone: normalizedPhone, date: dateStr, time: confirmedTime },
    });
  } catch (err) {
    console.error('[book-appointment] error:', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
