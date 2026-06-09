import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { sendSMS } from '@/lib/twilio';
import { safeCompare } from '@/lib/safe-compare';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const LOC = process.env.GHL_LOCATION_ID || 'Ra79aZSYkl96uPQajjkJ';

// Returns 'YYYY-MM' for the previous month
function prevMonth(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET) {
    console.error('[nps-report] CRON_SECRET not set');
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 });
  }
  if (!safeCompare(authHeader ?? '', `Bearer ${process.env.CRON_SECRET ?? ''}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.GHL_API_KEY;
  const rileyPhone = process.env.RILEY_PHONE;

  if (!apiKey || !rileyPhone) {
    return NextResponse.json({ error: 'GHL_API_KEY or RILEY_PHONE not configured' }, { status: 500 });
  }

  const supabase = createClient();
  const month = prevMonth();

  const { data: scores, error } = await supabase
    .from('nps_scores')
    .select('client_name, score, category, replied_at')
    .eq('survey_month', month);

  if (error) {
    console.error('[nps-report] DB fetch failed:', error.message);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }

  const rows = scores ?? [];
  const sent = rows.length;
  const replied = rows.filter((r) => r.replied_at !== null).length;
  const detractors = rows.filter((r) => r.category === 'detractor').length;
  const passives = rows.filter((r) => r.category === 'passive').length;
  const promoters = rows.filter((r) => r.category === 'promoter').length;

  const nps = sent === 0 ? 0 : Math.round(((promoters - detractors) / sent) * 100);

  // Format month label (e.g. "May 2026")
  const [year, mo] = month.split('-');
  const monthLabel = new Date(Date.UTC(Number(year), Number(mo) - 1, 1))
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  const responseRate = sent > 0 ? Math.round((replied / sent) * 100) : 0;

  const detractorNames = rows
    .filter((r) => r.category === 'detractor')
    .map((r) => r.client_name || 'Unknown')
    .join(', ');

  let msg = `TheHypeBox NPS — ${monthLabel}\n\nScore: ${nps > 0 ? '+' : ''}${nps}\nSurveyed: ${sent} | Replied: ${replied} (${responseRate}%)\nPromoters: ${promoters} | Passives: ${passives} | Detractors: ${detractors}`;

  if (detractors > 0) {
    msg += `\n\nDetractors: ${detractorNames}`;
  }

  try {
    await sendSMS(rileyPhone, msg, { apiKey, locationId: LOC });
    console.log(`[nps-report] SMS sent to Riley — NPS=${nps} month=${month}`);
  } catch (err) {
    console.error('[nps-report] SMS failed:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, month, nps, sent, replied, detractors, passives, promoters });
}
