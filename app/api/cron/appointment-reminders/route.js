import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { getAppointments, getContact } from '@/lib/ghl';

export const dynamic = 'force-dynamic';

// Runs daily at 8am — fetches tomorrow's appointments for every active client
// and sends an SMS reminder to each contact.

function tomorrowWindow() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() + 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

function formatTime(isoStr) {
  return new Date(isoStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/New_York',
  });
}

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient();

  const { data: clients, error } = await supabase
    .from('users')
    .select('id, business_name, ghl_api_key, ghl_location_id')
    .in('plan_status', ['active', 'trialing'])
    .not('ghl_api_key', 'is', null)
    .not('ghl_location_id', 'is', null);

  if (error) {
    console.error('[appointment-reminders] failed to load clients:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { startIso, endIso } = tomorrowWindow();
  let totalSent = 0;
  let totalSkipped = 0;
  const failures = [];

  for (const client of clients ?? []) {
    try {
      const appointments = await getAppointments(
        client.ghl_location_id,
        startIso,
        endIso,
        client.ghl_api_key
      );

      const upcoming = appointments.filter(
        (a) => a.appointmentStatus !== 'cancelled' && a.appointmentStatus !== 'invalid'
      );

      for (const appt of upcoming) {
        try {
          const contactId = appt.contactId || appt.contact?.id;
          if (!contactId) { totalSkipped++; continue; }

          const contact = await getContact(contactId, client.ghl_api_key);
          const phone = contact?.phone || contact?.mobilePhone || null;
          if (!phone) { totalSkipped++; continue; }

          const appointmentTime = formatTime(appt.startTime);
          const apptKey = `${phone}::${appt.startTime}`;

          // Dedup — skip if reminder already sent for this appointment
          const { data: existing } = await supabase
            .from('appointment_reminders')
            .select('id')
            .eq('phone_number', phone)
            .eq('appointment_time', appt.startTime)
            .single();

          if (existing) { totalSkipped++; continue; }

          const customerName = contact.firstName
            ? `${contact.firstName}${contact.lastName ? ' ' + contact.lastName : ''}`
            : 'there';

          const businessName = client.business_name || 'us';

          // Call the automation route directly
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://thehypeboxllc.com';
          const res = await fetch(`${baseUrl}/api/automations/appointment-reminder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone_number: phone,
              customer_name: customerName,
              business_name: businessName,
              appointment_time: appointmentTime,
              ghl_api_key: client.ghl_api_key,
              ghl_location_id: client.ghl_location_id,
              client_id: client.id,
            }),
          });

          if (res.ok) {
            totalSent++;
            console.log(`[appointment-reminders] sent to ${phone} for ${businessName} at ${appointmentTime}`);
          } else {
            const err = await res.json();
            failures.push({ phone, error: err.error || `HTTP ${res.status}` });
          }
        } catch (apptErr) {
          console.error(`[appointment-reminders] appt error for client ${client.id}:`, apptErr.message);
          failures.push({ client: client.business_name, error: apptErr.message });
        }
      }
    } catch (clientErr) {
      console.error(`[appointment-reminders] client ${client.id} failed:`, clientErr.message);
      failures.push({ client: client.business_name, error: clientErr.message });
    }
  }

  return NextResponse.json({
    ok: true,
    clients: clients?.length ?? 0,
    sent: totalSent,
    skipped: totalSkipped,
    failures,
    window: { startIso, endIso },
  });
}
