// Sends SMS via GHL's conversations API.
// Looks up the contact by phone in GHL (creates if not found), then sends.
// Accepts optional { apiKey, locationId } to support multi-tenant use later;
// defaults to Dave's env vars for now.

const GHL_BASE = 'https://services.leadconnectorhq.com';

function ghlHeaders(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    Version: '2021-07-28',
  };
}

function normalizePhone(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

async function findOrCreateContact(phone, locationId, apiKey) {
  const searchRes = await fetch(`${GHL_BASE}/contacts/search`, {
    method: 'POST',
    headers: ghlHeaders(apiKey),
    body: JSON.stringify({
      locationId,
      pageLimit: 1,
      filters: [{ field: 'phone', operator: 'eq', value: phone }],
    }),
  });

  if (searchRes.ok) {
    const data = await searchRes.json();
    const existing = data?.contacts?.[0];
    if (existing) return existing.id;
  }

  const createRes = await fetch(`${GHL_BASE}/contacts/`, {
    method: 'POST',
    headers: ghlHeaders(apiKey),
    body: JSON.stringify({ locationId, phone }),
  });

  const createData = await createRes.json();
  if (createData?.meta?.contactId) return createData.meta.contactId;
  if (!createRes.ok) throw new Error(`Failed to create contact: ${JSON.stringify(createData)}`);
  return createData.contact.id;
}

export async function sendSMS(to, body, { apiKey, locationId } = {}) {
  if (!apiKey || !locationId) {
    throw new Error('Missing GHL credentials for SMS — client must have ghl_api_key and ghl_location_id configured');
  }

  const resolvedApiKey = apiKey;
  const resolvedLocationId = locationId;

  const phone = normalizePhone(to);
  const contactId = await findOrCreateContact(phone, resolvedLocationId, resolvedApiKey);

  const res = await fetch(`${GHL_BASE}/conversations/messages`, {
    method: 'POST',
    headers: ghlHeaders(resolvedApiKey),
    body: JSON.stringify({
      type: 'SMS',
      contactId,
      locationId: resolvedLocationId,
      message: body,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `GHL SMS error: ${res.status}`);
  return data;
}
