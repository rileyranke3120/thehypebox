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
