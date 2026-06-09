import { NextResponse } from 'next/server';
import { addContactTags, addContactNote } from '@/lib/ghl';
import { analyzeLead, sendAlertSMS, logAlert } from '@/lib/inbound-alert';
import { safeCompare } from '@/lib/safe-compare';

// TheHypeBox's own GHL location — only process contacts from here
const EXPECTED_LOCATION_ID = 'Ra79aZSYkl96uPQajjkJ';

export async function POST(request) {
  const secret = new URL(request.url).searchParams.get('secret');
  if (!safeCompare(secret ?? '', process.env.AUTOMATION_WEBHOOK_SECRET ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  console.log('[ghl-new-contact] received payload keys:', Object.keys(payload));

  // GHL sends either flat format or nested { data: { ... } }
  const contact = payload.data || payload;
  const locationId = contact.locationId || payload.locationId;

  if (locationId && locationId !== EXPECTED_LOCATION_ID) {
    console.log('[ghl-new-contact] ignoring location:', locationId);
    return NextResponse.json({ ok: true, skipped: true });
  }

  const contactId = contact.id || contact.contactId;
  const apiKey = process.env.GHL_API_KEY;

  if (!contactId) {
    console.error('[ghl-new-contact] no contactId in payload');
    return NextResponse.json({ ok: false, error: 'missing contactId' }, { status: 400 });
  }

  if (!apiKey) {
    console.error('[ghl-new-contact] GHL_API_KEY not set');
    return NextResponse.json({ ok: false, error: 'server misconfigured' }, { status: 500 });
  }

  const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Unknown';
  const phone = contact.phone || contact.phoneNumbers?.[0]?.phoneNumber || 'No phone';

  let briefing = '';

  try {
    briefing = await analyzeLead(contact);
  } catch (err) {
    console.error('[ghl-new-contact] Anthropic error:', err.message);
    briefing = `New inbound lead: ${name} (${phone})`;
  }

  // Tag and note — fire-and-forget with individual error handling
  const tagPromise = addContactTags(contactId, ['new-inbound'], apiKey)
    .catch((err) => console.error('[ghl-new-contact] tag error:', err.message));

  const notePromise = addContactNote(contactId, `🤖 AI Lead Briefing\n\n${briefing}`, apiKey)
    .catch((err) => console.error('[ghl-new-contact] note error:', err.message));

  const smsMessage =
    `🚨 NEW LEAD\n` +
    `${name} | ${phone}\n\n` +
    `${briefing}`;

  const smsPromise = sendAlertSMS(smsMessage)
    .catch((err) => console.error('[ghl-new-contact] SMS error:', err.message));

  await Promise.all([tagPromise, notePromise, smsPromise]);

  logAlert({
    type: 'new-contact',
    contactId,
    name,
    phone,
    locationId: locationId || EXPECTED_LOCATION_ID,
    briefing,
  });

  return NextResponse.json({ ok: true });
}
