import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { safeCompare } from '@/lib/safe-compare';

export const dynamic = 'force-dynamic';

// GHL fires this when an opportunity status changes to "won".
// We record it in review_requests and the hourly cron handles sending.

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

  // GHL sends either flat or nested { data: {...} }
  const data = payload.data || payload;

  const status      = data.status || data.opportunityStatus;
  const locationId  = data.locationId || payload.locationId;
  const oppId       = data.id || data.opportunityId;
  const oppName     = data.name || data.opportunityName || '';

  console.log('[ghl-opportunity-won] type:', payload.type, '| status:', status, '| opp:', oppId);

  // Only act on "won"
  if (status !== 'won') {
    return NextResponse.json({ ok: true, skipped: true, reason: 'not won' });
  }

  if (!oppId) {
    console.error('[ghl-opportunity-won] missing opportunityId');
    return NextResponse.json({ error: 'missing opportunityId' }, { status: 400 });
  }

  // Extract contact — GHL may nest it under contact or send contactId only
  const contactBlock = data.contact || {};
  const contactId    = contactBlock.id || data.contactId;
  const contactName  = contactBlock.name
    || [contactBlock.firstName, contactBlock.lastName].filter(Boolean).join(' ')
    || '';
  const contactPhone = contactBlock.phone || contactBlock.phoneNumbers?.[0]?.phoneNumber || '';

  const supabase = createClient();

  // Look up the client's business name and Google review URL by location
  let businessName   = '';
  let googleReviewUrl = '';
  if (locationId) {
    const { data: clientRow } = await supabase
      .from('users')
      .select('business_name, google_review_url')
      .eq('ghl_location_id', locationId)
      .maybeSingle();
    businessName    = clientRow?.business_name    || '';
    googleReviewUrl = clientRow?.google_review_url || '';
  }

  const sendAfter = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from('review_requests').upsert({
    opportunity_id:   oppId,
    contact_id:       contactId   || null,
    location_id:      locationId  || null,
    phone_number:     contactPhone || null,
    customer_name:    contactName  || null,
    business_name:    businessName || null,
    service_type:     oppName      || null,
    google_review_url: googleReviewUrl || null,
    status:           'pending',
    send_after:       sendAfter,
  }, { onConflict: 'opportunity_id', ignoreDuplicates: true });

  if (error) {
    console.error('[ghl-opportunity-won] Supabase upsert error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log(`[ghl-opportunity-won] queued review request for opp ${oppId} — sends after ${sendAfter}`);
  return NextResponse.json({ ok: true, oppId, sendAfter });
}
