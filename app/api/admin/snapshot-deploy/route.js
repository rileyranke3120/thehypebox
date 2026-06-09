// Manual snapshot deployment endpoint.
// Used when a niche-specific snapshot becomes available after a client already signed up.
// GHL's public API does not support re-applying snapshots to existing locations,
// so this route queues a manual_required record and emails Riley the exact steps.

import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { sendEmail } from '@/lib/send-email';
import { safeCompare } from '@/lib/safe-compare';
import { getSnapshotForNiche } from '@/lib/niche-detector';

export const dynamic = 'force-dynamic';

const GHL_BASE = 'https://services.leadconnectorhq.com';

// Try an undocumented GHL snapshot-copy endpoint.
// Returns { success: true } if it works, throws otherwise.
async function tryGhlSnapshotApply(locationId, snapshotId) {
  const apiKey = process.env.GHL_AGENCY_KEY || process.env.GHL_AGENCY_API_KEY;
  if (!apiKey) throw new Error('GHL_AGENCY_KEY not set');

  // GHL does not have an official "apply snapshot to existing location" API.
  // This attempts the closest available mechanism. If GHL ever adds this,
  // the endpoint will succeed here and we skip the manual alert.
  const res = await fetch(`${GHL_BASE}/locations/${locationId}/snapshot`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Version: '2021-07-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ snapshotId }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GHL ${res.status}: ${text.slice(0, 200)}`);
  }
  return { success: true };
}

export async function POST(request) {
  const session = await auth();
  const authHeader = request.headers.get('authorization');
  const isAdmin = session?.user?.role === 'super_admin';
  const hasSecret = process.env.ADMIN_SECRET && safeCompare(authHeader ?? '', `Bearer ${process.env.ADMIN_SECRET}`);
  if (!isAdmin && !hasSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { email, locationId: locationIdOverride, snapshotId: snapshotIdOverride } = await request.json();
  if (!email && !locationIdOverride) {
    return NextResponse.json({ error: 'email or locationId is required' }, { status: 400 });
  }

  const supabase = createClient();

  let user = null;
  if (email) {
    const { data } = await supabase
      .from('users')
      .select('id, email, name, business_name, plan, ghl_location_id, niche, niche_confidence')
      .eq('email', email.toLowerCase())
      .single();
    user = data;
  }

  const locationId = locationIdOverride || user?.ghl_location_id;
  if (!locationId) {
    return NextResponse.json({ error: 'No GHL location found for this user' }, { status: 404 });
  }

  const niche = user?.niche || 'contractor';
  const { snapshotId, isNicheSpecific } = snapshotIdOverride
    ? { snapshotId: snapshotIdOverride, isNicheSpecific: true }
    : getSnapshotForNiche(niche);

  if (!snapshotId) {
    return NextResponse.json({ error: 'No snapshot ID available for this niche' }, { status: 400 });
  }

  // Try the GHL API first — if they ever add this endpoint it'll just work
  let apiSuccess = false;
  let apiError = null;
  try {
    await tryGhlSnapshotApply(locationId, snapshotId);
    apiSuccess = true;
    console.log(`[snapshot-deploy] API success for location ${locationId}`);
  } catch (err) {
    apiError = err.message;
    console.log(`[snapshot-deploy] API not available (${apiError}) — queuing manual alert`);
  }

  const status = apiSuccess ? 'applied' : 'manual_required';
  const businessName = user?.business_name || user?.name || email || locationId;

  // Log to snapshot_deployments
  await supabase.from('snapshot_deployments').insert({
    user_id: user?.id || null,
    location_id: locationId,
    niche,
    snapshot_id: snapshotId,
    status,
    confidence: user?.niche_confidence || 'manual',
    is_niche_specific: isNicheSpecific,
    notes: apiSuccess
      ? `Manual deploy via admin API — succeeded`
      : `Manual deploy requested — GHL API unavailable (${apiError}). Riley must apply in GHL UI.`,
  });

  if (!apiSuccess) {
    // Email Riley with exact manual steps
    await sendEmail({
      to: 'riley@thehypeboxllc.com',
      subject: `ACTION: Apply GHL snapshot for ${businessName} (${niche})`,
      html: `<div style="background:#0a0a0a;padding:32px 24px;font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;">
        <p style="font-size:1.2rem;font-weight:900;color:#FFD000;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.08em;">Snapshot Deploy — Manual Required</p>
        <p style="color:#fff;margin:0 0 16px;">The GHL API does not support applying snapshots to existing sub-accounts. You need to do this manually — takes about 60 seconds.</p>
        <div style="background:#111;border:1px solid #222;border-radius:6px;padding:16px;margin-bottom:24px;">
          <p style="margin:0 0 6px;font-size:0.75rem;color:#555;text-transform:uppercase;letter-spacing:0.08em;">Client</p>
          <p style="margin:0 0 12px;color:#fff;">${businessName}</p>
          <p style="margin:0 0 6px;font-size:0.75rem;color:#555;text-transform:uppercase;letter-spacing:0.08em;">Niche</p>
          <p style="margin:0 0 12px;color:#FFD000;font-weight:700;">${niche}</p>
          <p style="margin:0 0 6px;font-size:0.75rem;color:#555;text-transform:uppercase;letter-spacing:0.08em;">GHL Location ID</p>
          <p style="margin:0 0 12px;color:#fff;font-family:monospace;">${locationId}</p>
          <p style="margin:0 0 6px;font-size:0.75rem;color:#555;text-transform:uppercase;letter-spacing:0.08em;">Snapshot ID to Apply</p>
          <p style="margin:0;color:#fff;font-family:monospace;">${snapshotId}</p>
        </div>
        <p style="color:#FFD000;font-weight:700;margin:0 0 8px;">Steps to apply in GHL:</p>
        <ol style="color:#ccc;font-size:0.9rem;padding-left:20px;margin:0 0 20px;line-height:1.8;">
          <li>Open <strong>GHL Agency View</strong></li>
          <li>Go to <strong>Sub-accounts</strong> and search for location ID <code style="background:#222;padding:2px 6px;border-radius:3px;">${locationId}</code></li>
          <li>Click the <strong>3-dot menu</strong> next to the sub-account → <strong>Load Snapshot</strong></li>
          <li>Select snapshot ID <code style="background:#222;padding:2px 6px;border-radius:3px;">${snapshotId}</code></li>
          <li>Choose <strong>"Add missing data only"</strong> to avoid overwriting existing contacts/conversations</li>
          <li>Click <strong>Apply</strong></li>
        </ol>
        <p style="color:#555;font-size:0.8rem;margin:0;">After applying, mark done in the admin panel.</p>
      </div>`,
    });
  }

  return NextResponse.json({
    ok: true,
    status,
    locationId,
    snapshotId,
    niche,
    apiSuccess,
    message: apiSuccess
      ? 'Snapshot applied via GHL API'
      : 'GHL API unavailable — manual steps emailed to riley@thehypeboxllc.com',
  });
}

// GET: list pending manual snapshot deployments
export async function GET(request) {
  const session = await auth();
  const authHeader = request.headers.get('authorization');
  const isAdmin = session?.user?.role === 'super_admin';
  const hasSecret = process.env.ADMIN_SECRET && safeCompare(authHeader ?? '', `Bearer ${process.env.ADMIN_SECRET}`);
  if (!isAdmin && !hasSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('snapshot_deployments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deployments: data });
}
