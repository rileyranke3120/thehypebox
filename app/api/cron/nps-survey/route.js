import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { sendSMS } from '@/lib/twilio';
import { safeCompare } from '@/lib/safe-compare';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const LOC = process.env.GHL_LOCATION_ID || 'Ra79aZSYkl96uPQajjkJ';

function surveyMonth(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function normalizePhone(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET) {
    console.error('[nps-survey] CRON_SECRET not set');
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 });
  }
  if (!safeCompare(authHeader ?? '', `Bearer ${process.env.CRON_SECRET ?? ''}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.GHL_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GHL_API_KEY not configured' }, { status: 500 });
  }

  const supabase = createClient();
  const month = surveyMonth();

  const { data: rawClients, error } = await supabase
    .from('users')
    .select('id, name, phone, business_phone, plan_status, role')
    .eq('plan_status', 'active')
    .neq('role', 'super_admin');

  if (error) {
    console.error('[nps-survey] DB fetch failed:', error.message);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }

  const clients = (rawClients ?? []).filter((u) => u.phone || u.business_phone);

  if (clients.length === 0) {
    console.log('[nps-survey] no eligible clients');
    return NextResponse.json({ ok: true, month, sent: 0, skipped: 0, failed: 0 });
  }

  // Check which users already received a survey this month (batch query)
  const { data: existing } = await supabase
    .from('nps_scores')
    .select('user_id')
    .eq('survey_month', month);

  const alreadySentIds = new Set((existing ?? []).map((r) => r.user_id));

  const results = [];

  for (const client of clients) {
    if (alreadySentIds.has(client.id)) {
      results.push({ id: client.id, ok: true, skipped: 'already-sent' });
      continue;
    }

    const rawPhone = client.phone || client.business_phone;
    const phone = normalizePhone(rawPhone);
    const firstName = (client.name || 'there').split(' ')[0];

    try {
      const msg = `Hey ${firstName}, quick question — on a scale of 1-10, how likely are you to recommend TheHypeBox to another contractor? Just reply with a number. — Riley`;
      await sendSMS(phone, msg, { apiKey, locationId: LOC });

      await supabase.from('nps_scores').insert({
        user_id: client.id,
        client_name: client.name,
        client_phone: phone,
        survey_month: month,
        sent_at: new Date().toISOString(),
      });

      results.push({ id: client.id, phone, ok: true });
      console.log(`[nps-survey] sent → ${phone}`);
    } catch (err) {
      console.error(`[nps-survey] failed for ${client.id}:`, err.message);
      results.push({ id: client.id, ok: false, error: err.message });
    }
  }

  const sent = results.filter((r) => r.ok && !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;
  const failed = results.filter((r) => !r.ok).length;

  console.log(`[nps-survey] done — sent=${sent} skipped=${skipped} failed=${failed} month=${month}`);
  return NextResponse.json({ ok: true, month, sent, skipped, failed });
}
