import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { getAppointments, getContact } from '@/lib/ghl';
import { safeCompare } from '@/lib/safe-compare';

export const dynamic = 'force-dynamic';

// Runs daily at 6pm — fetches today's completed appointments for every active client
// and sends a post-service followup SMS.

function todayWindow() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  // Only appointments that have already ended (up to now)
  return { startIso: start.toISOString(), endIso: now.toISOString() };
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
    console.error('[post-service-followups] failed to load clients:', error.message);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }

  const { startIso, endIso } = todayWindow();
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

      // Only send followups for appointments that actually happened (showed or no status = completed)
      const completed = appointments.filter(
        (a) => a.appointmentStatus === 'showed' || a.appointmentStatus === 'completed' || !a.appointmentStatus
      );

      // Batch all GHL contact fetches for this client's completed appointments
      const apptContactIds = completed.map((appt) => ({
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
              console.error(`[post-service-followups] getContact failed for ${contactId}:`, err.message);
              return { appt, contact: null };
            })
        )
      );

      for (const { appt, contact } of contactResults) {
        if (!contact) { totalSkipped++; continue; }
        try {
          const phone = contact.phone || contact.mobilePhone || null;
          if (!phone) { totalSkipped++; continue; }

          // Dedup — skip if followup already sent for this appointment
          const { data: existing } = await supabase
            .from('post_service_followups')
            .select('id')
            .eq('phone_number', phone)
            .eq('client_id', client.id)
            .gte('sent_at', startIso)
            .single();

          if (existing) { totalSkipped++; continue; }

          const customerName = contact.firstName
            ? `${contact.firstName}${contact.lastName ? ' ' + contact.lastName : ''}`
            : 'there';

          const businessName = client.business_name || 'us';
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://thehypeboxllc.com';

          const res = await fetch(`${baseUrl}/api/automations/post-service-followup`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-webhook-secret': process.env.AUTOMATION_WEBHOOK_SECRET || '',
            },
            body: JSON.stringify({
              phone_number: phone,
              customer_name: customerName,
              business_name: businessName,
              client_id: client.id,
            }),
          });

          if (res.ok) {
            totalSent++;
            console.log(`[post-service-followups] sent to ${phone} for ${businessName}`);
          } else {
            let errMsg = `HTTP ${res.status}`;
            try { const body = await res.json(); errMsg = body.error || errMsg; } catch (_) {}
            failures.push({ phone, error: errMsg });
          }
        } catch (apptErr) {
          console.error(`[post-service-followups] appt error for client ${client.id}:`, apptErr.message);
          failures.push({ client: client.business_name, error: apptErr.message });
        }
      }
    } catch (clientErr) {
      console.error(`[post-service-followups] client ${client.id} failed:`, clientErr.message);
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
