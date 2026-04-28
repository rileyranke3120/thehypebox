const GHL_BASE = 'https://services.leadconnectorhq.com';

function ghlHeaders(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    Version: '2021-07-28',
    'Content-Type': 'application/json',
  };
}

export async function ghlFetch(path, apiKey, options = {}) {
  const res = await fetch(`${GHL_BASE}${path}`, {
    ...options,
    headers: { ...ghlHeaders(apiKey), ...(options.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GHL ${res.status} on ${path}: ${text}`);
  }
  return res.json();
}

// Returns all contacts for a location
export async function getContacts(locationId, apiKey) {
  const data = await ghlFetch(`/contacts/?locationId=${locationId}&limit=100`, apiKey);
  return (data?.contacts) ?? [];
}

// Returns opportunities (pipeline leads)
export async function getOpportunities(locationId, apiKey) {
  const data = await ghlFetch(
    `/opportunities/search?location_id=${locationId}&limit=100`, apiKey
  );
  return (data?.opportunities) ?? [];
}

// Returns calendar events between two ISO strings
export async function getAppointments(locationId, startIso, endIso, apiKey) {
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();
  const data = await ghlFetch(
    `/calendars/events?locationId=${locationId}&startTime=${startMs}&endTime=${endMs}`, apiKey
  );
  return (data?.events) ?? [];
}

// Returns reviews
export async function getReviews(locationId, apiKey) {
  const data = await ghlFetch(`/reputation/review?locationId=${locationId}`, apiKey);
  return (data?.reviews) ?? [];
}

// Returns free calendar slots for a given day (YYYY-MM-DD)
export async function getCalendarFreeSlots(calendarId, dateYMD, apiKey, timezone = 'America/New_York') {
  const [year, month, day] = dateYMD.split('-').map(Number);
  const startMs = new Date(year, month - 1, day, 0, 0, 0).getTime();
  const endMs   = new Date(year, month - 1, day, 23, 59, 59).getTime();
  const tz = encodeURIComponent(timezone);
  const data = await ghlFetch(
    `/calendars/${calendarId}/free-slots?startDate=${startMs}&endDate=${endMs}&timezone=${tz}`,
    apiKey
  );
  // GHL returns { _dates_: { "YYYY-MM-DD": { slots: [...] } } } or { slots: [...] }
  const dateSlots = data?._dates_?.[dateYMD]?.slots ?? data?.slots ?? [];
  return dateSlots;
}

// Find a GHL contact by phone number; returns contactId or null
export async function findContactByPhone(locationId, phone, apiKey) {
  const data = await ghlFetch(
    `/contacts/?locationId=${locationId}&query=${encodeURIComponent(phone)}&limit=1`,
    apiKey
  );
  return data?.contacts?.[0]?.id ?? null;
}

// Create a GHL contact and return its id
export async function createContact(locationId, { name, phone }, apiKey) {
  const data = await ghlFetch('/contacts/', apiKey, {
    method: 'POST',
    body: JSON.stringify({ locationId, name: name || 'Phone Caller', phone }),
  });
  return data?.contact?.id ?? data?.id ?? null;
}

// Book an appointment on a GHL calendar
export async function createGhlAppointment(
  { calendarId, locationId, contactId, startIso, endIso, title = 'Phone Booking' },
  apiKey
) {
  const data = await ghlFetch('/calendars/events/appointments', apiKey, {
    method: 'POST',
    body: JSON.stringify({ calendarId, locationId, contactId, startTime: startIso, endTime: endIso, title }),
  });
  return data;
}
