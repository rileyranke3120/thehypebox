import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { updateSubAccount } from '@/lib/highlevel';
import { auth } from '@/auth';
import { detectNiche, getSnapshotForNiche } from '@/lib/niche-detector';
import { sendEmail } from '@/lib/send-email';

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

    // Detect niche from business name and update if it changed
    if (business_name) {
      const detected = detectNiche(business_name, email);
      updates.niche = detected.niche;
      updates.niche_confidence = detected.confidence;
    }

    const { data: user, error } = await supabase
      .from('users')
      .update(updates)
      .eq('email', email.toLowerCase())
      .select('id, ghl_location_id, niche, niche_confidence')
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

      // Alert Riley if a niche-specific snapshot now exists that wasn't available at signup.
      // The GHL API cannot re-apply snapshots post-creation, so Riley must do this manually.
      if (business_name) {
        const { isNicheSpecific } = getSnapshotForNiche(user.niche);
        if (isNicheSpecific) {
          const { snapshotId } = getSnapshotForNiche(user.niche);
          sendEmail({
            to: 'riley@thehypeboxllc.com',
            subject: `Snapshot upgrade available: ${business_name} (${user.niche})`,
            html: `<div style="background:#0a0a0a;padding:32px 24px;font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;">
              <p style="font-size:1.2rem;font-weight:900;color:#FFD000;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em;">Snapshot Upgrade Available</p>
              <p style="color:#fff;margin:0 0 12px;">A niche-specific GHL snapshot exists for a client that signed up with the default Contractor Box.</p>
              <div style="background:#111;border:1px solid #222;border-radius:6px;padding:16px;margin-bottom:20px;">
                <p style="margin:0 0 6px;font-size:0.75rem;color:#555;text-transform:uppercase;letter-spacing:0.08em;">Business</p>
                <p style="margin:0 0 12px;color:#fff;">${business_name}</p>
                <p style="margin:0 0 6px;font-size:0.75rem;color:#555;text-transform:uppercase;letter-spacing:0.08em;">Detected Niche</p>
                <p style="margin:0 0 12px;color:#FFD000;font-weight:700;">${user.niche}</p>
                <p style="margin:0 0 6px;font-size:0.75rem;color:#555;text-transform:uppercase;letter-spacing:0.08em;">GHL Location</p>
                <p style="margin:0 0 12px;color:#fff;font-family:monospace;">${user.ghl_location_id}</p>
                <p style="margin:0 0 6px;font-size:0.75rem;color:#555;text-transform:uppercase;letter-spacing:0.08em;">Niche Snapshot ID</p>
                <p style="margin:0;color:#fff;font-family:monospace;">${snapshotId}</p>
              </div>
              <p style="color:#999;font-size:0.85rem;margin:0 0 8px;">To apply the niche snapshot manually in GHL:</p>
              <ol style="color:#999;font-size:0.85rem;padding-left:20px;margin:0;">
                <li>Go to Agency View → Sub-accounts → find <strong style="color:#fff;">${business_name}</strong></li>
                <li>Click the three-dot menu → <strong>Load Snapshot</strong></li>
                <li>Select the <strong style="color:#FFD000;">${user.niche}</strong> snapshot</li>
                <li>Choose <strong>Add missing data only</strong> (avoid overwriting existing contacts)</li>
              </ol>
            </div>`,
          }).catch(() => {});

          supabase.from('snapshot_deployments').insert({
            user_id: user.id,
            location_id: user.ghl_location_id,
            niche: user.niche,
            snapshot_id: snapshotId,
            status: 'manual_required',
            confidence: user.niche_confidence,
            matched_keyword: null,
            is_niche_specific: true,
            notes: `Niche confirmed at onboarding (business_name: ${business_name}). Manual re-snapshot required.`,
          }).then(() => {}).catch(() => {});
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/onboarding]', err);
    return NextResponse.json({ error: 'Failed to save settings.' }, { status: 500 });
  }
}
