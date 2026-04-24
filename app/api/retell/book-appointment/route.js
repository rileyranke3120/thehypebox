/**
 * POST /api/retell/book-appointment
 *
 * Accepts: { name, phone, address, date, time, email (optional) }
 * date and time are raw natural language strings from the caller —
 * e.g. "this Thursday", "April 24th", "10am", "two o clock".
 * We parse them server-side using chrono-node with today's Eastern date as reference.
 *
 * - Searches GHL for existing contact by phone, creates if not found
 * - Books appointment on GHL calendar
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

// Determines the Eastern UTC offset for a given date (-4 for EDT, -5 for EST)
function easternOffsetForDate(dateStr) {
  const noonUtc = new Date(`${dateStr}T12:00:00Z`);
  const easternHour = parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      hour12: false,
    }).format(noonUtc),
    10
  );
  return easternHour - 12; // e.g. -4 for EDT, -5 for EST
}

// Parse a raw natural language date string into "YYYY-MM-DD"
// Uses today's Eastern date as the reference point for relative expressions
function parseDate(raw) {
  const ref = todayEastern();
  const parsed = chrono.parseDate(raw, ref, { forwardDate: true });
  if (!parsed) throw new Error(`Could not understand date: "${raw}"`);
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const d = String(parsed.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Parse a raw natural language time string into "H:MM AM/PM"
// Combines with a known date so chrono has full context
function parseTime(rawTime, dateStr) {
  const ref = todayEastern();
  // Feed chrono the date + time together for best results
  const combined = `${dateStr} ${rawTime}`;
  const parsed = chrono.parseDate(combined, ref, { forwardDate: true });
  if (!parsed) throw new Error(`Could not understand time: "${rawTime}"`);
  let hours = parsed.getHours();
  const minutes = parsed.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  if (hours > 12) hours -= 12;
  if (hours === 0) hours = 12;
  return `${hours}:${String(minutes).padStart(2, '0')} ${ampm}`;
}

// Build an ISO 8601 datetime string with the correct Eastern offset
function toISO(dateStr, timeStr) {
  // timeStr is "H:MM AM/PM" at this point
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) throw new Error(`Unexpected time format after parsing: "${timeStr}"`);
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && hours !== 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;
  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');

  const offsetHours = easternOffsetForDate(dateStr);
  const sign = offsetHours <= 0 ? '-' : '+';
  const tzSuffix = `${sign}${String(Math.abs(offsetHours)).padStart(2, '0')}:00`;

  return `${dateStr}T${hh}:${mm}:00${tzSuffix}`;
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
  if (!res.ok) throw new Error(`Failed to create contact: ${JSON.stringify(data)}`);
  return data.contact.id;
}

async function bookAppointment({ contactId, dateStr, timeStr }) {
  const startTime = toISO(dateStr, timeStr);

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

  const { name, phone, email, address, date: rawDate, time: rawTime } = body;

  if (!name || !phone || !address || !rawDate || !rawTime) {
    return Response.json(
      { error: 'name, phone, address, date, and time are required' },
      { status: 400 }
    );
  }

  console.log(`[book-appointment] raw input — date="${rawDate}" time="${rawTime}"`);

  // Parse natural language date and time
  let dateStr, timeStr;
  try {
    dateStr = parseDate(rawDate);
    timeStr = parseTime(rawTime, dateStr);
  } catch (err) {
    console.error('[book-appointment] parse error:', err.message);
    return Response.json({ error: err.message }, { status: 422 });
  }

  console.log(`[book-appointment] parsed — date="${dateStr}" time="${timeStr}"`);

  const normalizedPhone = normalizePhone(phone);

  try {
    let contactId = await findContactByPhone(normalizedPhone);
    if (!contactId) {
      console.log(`[book-appointment] creating contact for ${normalizedPhone}`);
      contactId = await createContact({ name, phone: normalizedPhone, email, address });
    } else {
      console.log(`[book-appointment] found existing contact ${contactId}`);
    }

    const appointment = await bookAppointment({ contactId, dateStr, timeStr });
    const appointmentId = appointment.id ?? appointment.appointmentId ?? appointment._id;

    console.log(`[book-appointment] success — appointmentId=${appointmentId} for ${name} on ${dateStr} at ${timeStr}`);

    return Response.json({
      success: true,
      appointmentId,
      contactId,
      confirmation: `Got it! I've booked your appointment for ${dateStr} at ${timeStr}. You'll receive a confirmation shortly.`,
      details: { name, phone: normalizedPhone, date: dateStr, time: timeStr },
    });
  } catch (err) {
    console.error('[book-appointment] error:', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
