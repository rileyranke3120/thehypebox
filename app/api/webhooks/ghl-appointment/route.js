import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { sendSMS } from '@/lib/twilio';
import { safeCompare } from '@/lib/safe-compare';

const DEMO_CALENDAR_ID = 'Ws5pQCTkYNNeqtSwGII4';
const FALLBACK_LOCATION_ID = 'Ra79aZSYkl96uPQajjkJ';

const BOOKING_EVENTS = new Set([
  'AppointmentBooked',
  'AppointmentCreate',
  'AppointmentCreated',
  'AppointmentUpdated',
  'AppointmentConfirmed',
]);

const CANCEL_EVENTS = new Set([
  'AppointmentCancelled',
  'AppointmentCancel',
  'AppointmentDeleted',
]);

function formatDateTime(isoStr) {
  return new Date(isoStr).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function buildRows(appointmentId, contactId, locationId, contactName, contactPhone, contactBusiness, calendarId, startIso, endIso) {
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();
  const now = new Date().toISOString();

  const steps = [
    { phase: 'pre',  step: 'confirm',      fire_at: now },
    { phase: 'pre',  step: 'reminder_24h', fire_at: new Date(startMs - 24 * 60 * 60 * 1000).toISOString() },
    { phase: 'pre',  step: 'reminder_1h',  fire_at: new Date(startMs - 60 * 60 * 1000).toISOString() },
    { phase: 'post', step: 'followup_ai',  fire_at: new Date(endMs + 60 * 60 * 1000).toISOString() },
    { phase: 'post', step: 'followup_24h', fire_at: new Date(endMs + 25 * 60 * 60 * 1000).toISOString() },
    { phase: 'post', step: 'followup_48h', fire_at: new Date(endMs + 49 * 60 * 60 * 1000).toISOString() },
    { phase: 'post', step: 'breakup_7d',   fire_at: new Date(endMs + 7 * 24 * 60 * 60 * 1000).toISOString() },
  ];

  return steps.map((s) => ({
    appointment_id:    appointmentId,
    contact_id:        contactId,
    location_id:       locationId,
    contact_name:      contactName,
    contact_phone:     contactPhone,
    contact_business:  contactBusiness,
    calendar_id:       calendarId,
    appointment_start: startIso,
    appointment_end:   endIso,
    status:            'pending',
    ...s,
  }));
}

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

  const type = payload.type || payload.event;
  console.log('[ghl-appointment] event type:', type);

  // Handle cancellations — mark all pending steps as skipped
  if (CANCEL_EVENTS.has(type)) {
    const appointmentId = payload.data?.id || payload.appointmentId || payload.id;
    if (appointmentId) {
      const supabase = createClient();
      const { error } = await supabase
        .from('demo_sequences')
        .update({ status: 'skipped' })
        .eq('appointment_id', appointmentId)
        .eq('status', 'pending');
      if (error) console.error('[ghl-appointment] cancel update error:', error.message);
      console.log('[ghl-appointment] skipped pending steps for appointment:', appointmentId);
    }
    return NextResponse.json({ ok: true, action: 'cancelled' });
  }

  if (!BOOKING_EVENTS.has(type)) {
    console.log('[ghl-appointment] ignoring event type:', type);
    return NextResponse.json({ ok: true, skipped: true });
  }

  // Normalize — GHL sends data nested or flat depending on webhook version
  const appt    = payload.data || payload.appointment || payload;
  const contact = payload.contact || {};

  const calendarId    = appt.calendarId    || appt.calendar_id;
  const locationId    = appt.locationId    || payload.locationId || FALLBACK_LOCATION_ID;
  const appointmentId = appt.id            || appt.appointmentId;
  const startIso      = appt.startTime     || appt.start_time    || appt.startAt;
  const endIso        = appt.endTime       || appt.end_time      || appt.endAt;
  const contactId     = appt.contactId     || contact.id;

  if (calendarId !== DEMO_CALENDAR_ID) {
    console.log('[ghl-appointment] ignoring calendar:', calendarId);
    return NextResponse.json({ ok: true, skipped: true });
  }

  if (!appointmentId || !startIso || !endIso || !contactId) {
    console.error('[ghl-appointment] missing required fields:', { appointmentId, startIso, endIso, contactId });
    return NextResponse.json({ error: 'missing required fields' }, { status: 400 });
  }

  const firstName    = contact.firstName   || appt.firstName   || '';
  const lastName     = contact.lastName    || appt.lastName    || '';
  const contactName  = [firstName, lastName].filter(Boolean).join(' ') || null;
  const contactPhone = contact.phone       || appt.phone       || null;
  const contactBiz   = contact.companyName || appt.companyName || contact.businessName || null;
  const first        = firstName || 'there';
  const resolvedLoc  = locationId || FALLBACK_LOCATION_ID;

  const rows = buildRows(
    appointmentId, contactId, resolvedLoc,
    contactName, contactPhone, contactBiz,
    calendarId, startIso, endIso,
  );

  const supabase = createClient();
  const { error } = await supabase
    .from('demo_sequences')
    .upsert(rows, { onConflict: 'appointment_id,step', ignoreDuplicates: true });

  if (error) {
    console.error('[ghl-appointment] DB upsert error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Send confirmation SMS immediately — don't wait for the daily cron
  let confirmSent = false;
  const apiKey = process.env.GHL_API_KEY;
  if (contactPhone && apiKey) {
    const dt = formatDateTime(startIso);
    const confirmText = `Hey ${first}! Your HypeBox demo is confirmed — ${dt}. We'll show you exactly how AI automation can work in your business. See you then!\n– Riley @ TheHypeBox`;

    try {
      await sendSMS(contactPhone, confirmText, { apiKey, locationId: resolvedLoc });
      // Mark confirm step as sent so the daily cron skips it
      await supabase
        .from('demo_sequences')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('appointment_id', appointmentId)
        .eq('step', 'confirm');
      confirmSent = true;
      console.log(`[ghl-appointment] confirmation SMS sent to ${contactPhone}`);
    } catch (smsErr) {
      console.error('[ghl-appointment] confirmation SMS failed:', smsErr.message);
    }
  }

  console.log(`[ghl-appointment] scheduled 7 steps for appointment ${appointmentId} (${contactName || 'unknown'}), confirm=${confirmSent}`);
  return NextResponse.json({ ok: true, steps: rows.length, appointmentId, confirmSent });
}
