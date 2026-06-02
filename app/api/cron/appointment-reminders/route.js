import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { getAppointments, getContact } from '@/lib/ghl';
import { safeCompare } from '@/lib/safe-compare';

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
  if (!process.env.CRON_SECRET) {
    console.error('[cron] CRON_SECRET env var is not set');
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 });
  }
  if (!safeCompare(authHeader ?? '', `Bearer ${process.env.CRON_SECRET ?? ''}`)) {
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
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
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

      // Batch all GHL contact fetches for this client's appointments
      const apptContactIds = upcoming.map((appt) => ({
        appt,
        contactId: appt.contactId || appt.contact?.id,
      }));
      totalSkipped += apptContactIds.filter((a) => !a.contactId).length;
      const withContactId = apptContactIds.filter((a) => a.contactId);

      const contactResults = await Promise.all(
        withContactId.map(({ appt, contactId }) =>
          getContact(contactId, client.ghl_api_key)
            .then((contact) => ({ appt, contact }))
            .catch((err) => {
              console.error(`[appointment-reminders] getContact failed for ${contactId}:`, err.message);
              return { appt, contact: null };
            })
        )
      );

      for (const { appt, contact } of contactResults) {
        if (!contact) { totalSkipped++; continue; }
        try {
          const phone = contact.phone || contact.mobilePhone || null;
          if (!phone) { totalSkipped++; continue; }

          const appointmentTime = formatTime(appt.startTime);

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

          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://thehypeboxllc.com';
          const res = await fetch(`${baseUrl}/api/automations/appointment-reminder`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-webhook-secret': process.env.AUTOMATION_WEBHOOK_SECRET || '',
            },
            body: JSON.stringify({
              phone_number: phone,
              customer_name: customerName,
              business_name: businessName,
              appointment_time: appointmentTime,
              client_id: client.id,
            }),
          });

          if (res.ok) {
            totalSent++;
            console.log(`[appointment-reminders] sent to ${phone} for ${businessName} at ${appointmentTime}`);
          } else {
            let errMsg = `HTTP ${res.status}`;
            try { const body = await res.json(); errMsg = body.error || errMsg; } catch (_) {}
            failures.push({ phone, error: errMsg });
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
