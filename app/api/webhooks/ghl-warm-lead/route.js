import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { sendSMS } from '@/lib/twilio';
import { addContactNote } from '@/lib/ghl';
import { safeCompare } from '@/lib/safe-compare';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const WARM_TAGS = new Set(['warm', 'warm-lead', 'warm_lead']);
const NICHE_VALUES = { plumber: 350, hvac: 500, electrician: 400, concrete: 800 };
const NICHE_LABELS = { plumber: 'plumbing', hvac: 'HVAC', electrician: 'electrical', concrete: 'concrete coating' };

function detectNiche(tags = []) {
  for (const tag of tags) {
    const t = tag.toLowerCase().trim();
    if (NICHE_VALUES[t]) return t;
  }
  return null;
}

function isWarmTag(payload) {
  const tagAdded = payload.tagAdded || payload.data?.tagAdded || '';
  if (tagAdded && WARM_TAGS.has(tagAdded.toLowerCase().trim())) return true;
  const tags = payload.data?.tags || payload.tags || [];
  return tags.some(t => WARM_TAGS.has(t.toLowerCase().trim()));
}

async function callClaude({ firstName, businessName, niche }) {
  const jobValue   = NICHE_VALUES[niche] || 400;
  const nicheLabel = NICHE_LABELS[niche] || 'contracting';
  const biz        = businessName || `${firstName}'s business`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: `You are calculating ROI for a ${nicheLabel} contractor evaluating Sarah, an AI phone receptionist ($97-297/month).

Business: ${biz}
Trade: ${nicheLabel}
Job value per service call: $${jobValue}
Missed calls: busy ${nicheLabel} contractors miss 3-5 calls/day

Formula: missed_calls_per_day × $${jobValue} × 30 days = monthly_lost_revenue
Pick a realistic missed_calls_per_day (3-5). Round monthly_lost to nearest $500.

Write a punchy SMS under 160 chars:
"Hey ${firstName}, just ran the numbers — ${biz} is likely losing $[monthly_lost]/month in missed calls. Sarah pays for herself in the first week."

Return ONLY valid JSON:
{"missed_calls_per_day":<int>,"job_value":${jobValue},"monthly_lost":<int>,"plan_cost":97,"sms_message":"<the exact SMS text>"}`,
      }],
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data  = await res.json();
  const text  = (data.content?.[0]?.text || '').trim();
  const match = text.match(/\{[\s\S]*?\}/);
  if (!match) throw new Error('No JSON in Claude response');
  return JSON.parse(match[0]);
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

  console.log('[ghl-warm-lead] type:', payload.type, '| tagAdded:', payload.tagAdded || payload.data?.tagAdded);

  if (!isWarmTag(payload)) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'not warm-lead' });
  }

  const contact    = payload.data || payload;
  const contactId  = contact.id || contact.contactId;
  const firstName  = contact.firstName || (contact.name || '').split(' ')[0] || 'there';
  const fullName   = contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(' ') || firstName;
  const bizName    = contact.companyName || contact.businessName || fullName;
  const phone      = contact.phone || contact.phoneNumbers?.[0]?.phoneNumber || '';
  const tags       = contact.tags || [];
  const locationId = contact.locationId || payload.locationId;
  const niche      = detectNiche(tags);

  if (!phone) {
    console.warn('[ghl-warm-lead] no phone for contact', contactId, '— skipping');
    return NextResponse.json({ ok: true, skipped: true, reason: 'no phone' });
  }

  const supabase = createClient();

  const { data: existing } = await supabase
    .from('roi_calculations')
    .select('id')
    .eq('contact_id', contactId)
    .maybeSingle();

  if (existing) {
    console.log('[ghl-warm-lead] duplicate — already ran ROI for contact', contactId);
    return NextResponse.json({ ok: true, skipped: true, reason: 'already calculated' });
  }

  const apiKey = process.env.GHL_LOCATION_KEY;
  const locId  = process.env.GHL_LOCATION_ID;

  if (!apiKey || !locId) {
    console.error('[ghl-warm-lead] missing GHL_LOCATION_KEY or GHL_LOCATION_ID');
    return NextResponse.json({ error: 'server misconfigured' }, { status: 500 });
  }

  let roi;
  try {
    roi = await callClaude({ firstName, businessName: bizName, niche: niche || 'contractor' });
  } catch (err) {
    console.error('[ghl-warm-lead] Claude error:', err.message);
    const jobValue = NICHE_VALUES[niche] || 400;
    const monthly  = Math.round((4 * jobValue * 30) / 500) * 500;
    roi = {
      missed_calls_per_day: 4,
      job_value:   jobValue,
      monthly_lost: monthly,
      plan_cost:   97,
      sms_message: `Hey ${firstName}, just ran the numbers — ${bizName} is likely losing $${monthly.toLocaleString()}/month in missed calls. Sarah pays for herself in the first week.`,
    };
  }

  let smsSent = false;
  try {
    await sendSMS(phone, roi.sms_message, { apiKey, locationId: locId });
    smsSent = true;
    console.log(`[ghl-warm-lead] SMS sent to ${phone}`);
  } catch (err) {
    console.error('[ghl-warm-lead] SMS send error:', err.message);
  }

  const { error: dbError } = await supabase.from('roi_calculations').insert({
    contact_id:       contactId    || null,
    location_id:      locationId   || null,
    contact_name:     fullName,
    business_name:    bizName,
    phone,
    niche:            niche        || 'unknown',
    missed_calls_day: roi.missed_calls_per_day,
    job_value:        roi.job_value,
    monthly_lost:     roi.monthly_lost,
    plan_cost:        roi.plan_cost,
    sms_message:      roi.sms_message,
    sms_sent:         smsSent,
  });

  if (dbError) console.error('[ghl-warm-lead] Supabase error:', dbError.message);

  if (contactId) {
    const monthly = roi.monthly_lost?.toLocaleString?.() || roi.monthly_lost;
    addContactNote(
      contactId,
      `[ROI Calc] Est. $${monthly}/mo lost to missed calls (${niche || 'contractor'}, $${roi.job_value}/job × ${roi.missed_calls_per_day} calls/day × 30 days). SMS sent: ${smsSent ? 'yes' : 'no'}`,
      apiKey
    ).catch(err => console.error('[ghl-warm-lead] note error:', err.message));
  }

  return NextResponse.json({
    ok: true,
    contactId,
    niche,
    monthly_lost: roi.monthly_lost,
    sms_sent:     smsSent,
  });
}
