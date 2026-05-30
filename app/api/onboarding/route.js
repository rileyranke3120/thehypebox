import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { updateSubAccount } from '@/lib/highlevel';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

const VALID_STATUSES = ['active', 'trialing'];

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.user.role !== 'super_admin' && !VALID_STATUSES.includes(session.user.plan_status)) {
    return NextResponse.json({ error: 'Subscription required.' }, { status: 402 });
  }

  try {
    const { business_name, phone, address, google_review_url } = await request.json();

    const email = session.user.email;

    // Validate google_review_url if provided — must be a real https URL
    if (google_review_url) {
      try {
        const parsed = new URL(google_review_url);
        if (parsed.protocol !== 'https:') throw new Error();
      } catch {
        return NextResponse.json({ error: 'google_review_url must be a valid https URL' }, { status: 400 });
      }
    }

    const supabase = createClient();

    const updates = {};
    if (business_name) updates.business_name = String(business_name).slice(0, 200);
    if (phone) updates.business_phone = String(phone).slice(0, 30);
    if (address) updates.address = String(address).slice(0, 500);
    if (google_review_url) updates.google_review_url = String(google_review_url).slice(0, 500);

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: true });
    }

    const { data: user, error } = await supabase
      .from('users')
      .update(updates)
      .eq('email', email.toLowerCase())
      .select('ghl_location_id')
      .single();

    if (error) throw error;

    // If the GHL sub-account was already provisioned by the Stripe webhook,
    // update it now with the real business data from the onboarding form.
    if (user?.ghl_location_id) {
      try {
        await updateSubAccount(user.ghl_location_id, {
          businessName: business_name,
          phone,
          address,
        });
      } catch (hlErr) {
        // Non-fatal — Supabase is updated; GHL can be corrected from the admin panel.
        console.error('[api/onboarding] GHL location update failed:', hlErr.message);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/onboarding]', err);
    return NextResponse.json({ error: 'Failed to save settings.' }, { status: 500 });
  }
}
