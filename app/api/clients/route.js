import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function GET() {
  const session = await auth();
  if (!session || session.user?.role !== 'super_admin') {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('users')
      .select('id, email, name, business_name, plan, plan_status, role, active, created_at, ghl_location_id, retell_agent_id, trial_ends_at')
      .eq('role', 'client')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ ok: true, clients: data });
  } catch (error) {
    console.error('[clients GET]', error);
    return NextResponse.json({ ok: false, error: 'Something went wrong.' }, { status: 500 });
  }
}

export async function PATCH(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();

    // Admins may target any user by email; regular clients can only update themselves
    const email = (session.user?.role === 'super_admin' && body.email) ? body.email : session.user.email;

    // Accept both short form (phone/hours — dashboard form) and canonical (business_phone/business_hours)
    const updates = {};
    if (body.business_name !== undefined) {
      if (body.business_name && body.business_name.length > 200) return NextResponse.json({ ok: false, error: 'business_name must be 200 characters or fewer.' }, { status: 400 });
      updates.business_name = body.business_name || null;
    }
    if (body.business_phone !== undefined) {
      if (body.business_phone && body.business_phone.length > 30) return NextResponse.json({ ok: false, error: 'business_phone must be 30 characters or fewer.' }, { status: 400 });
      updates.business_phone = body.business_phone || null;
    }
    if (body.phone !== undefined) {
      if (body.phone && body.phone.length > 30) return NextResponse.json({ ok: false, error: 'business_phone must be 30 characters or fewer.' }, { status: 400 });
      updates.business_phone = body.phone || null;
    }
    if (body.business_hours !== undefined) {
      if (body.business_hours && body.business_hours.length > 500) return NextResponse.json({ ok: false, error: 'business_hours must be 500 characters or fewer.' }, { status: 400 });
      updates.business_hours = body.business_hours || null;
    }
    if (body.hours !== undefined) {
      if (body.hours && body.hours.length > 500) return NextResponse.json({ ok: false, error: 'business_hours must be 500 characters or fewer.' }, { status: 400 });
      updates.business_hours = body.hours || null;
    }
    if (body.avatar_url !== undefined) {
      const rawAvatarUrl = body.avatar_url || null;
      if (rawAvatarUrl) {
        if (rawAvatarUrl.length > 500) return NextResponse.json({ ok: false, error: 'avatar_url must be 500 characters or fewer.' }, { status: 400 });
        try {
          const parsed = new URL(rawAvatarUrl);
          if (parsed.protocol !== 'https:') throw new Error('not https');
        } catch {
          return NextResponse.json({ ok: false, error: 'avatar_url must be a valid https URL.' }, { status: 400 });
        }
      }
      updates.avatar_url = rawAvatarUrl;
    }

    if (body.google_review_url !== undefined) {
      const rawUrl = body.google_review_url || null;
      if (rawUrl) {
        try {
          const parsed = new URL(rawUrl);
          if (parsed.protocol !== 'https:') throw new Error('not https');
        } catch {
          return NextResponse.json({ ok: false, error: 'google_review_url must be a valid https URL.' }, { status: 400 });
        }
      }
      updates.google_review_url = rawUrl;
    }

    if (body.toggles !== undefined) {
      const ALLOWED_TOGGLE_KEYS = ['review_requests', 'appointment_reminders', 'lead_nurture', 'reactivation', 'missed_call_followup'];
      const raw = body.toggles;
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const filtered = {};
        for (const key of ALLOWED_TOGGLE_KEYS) {
          if (key in raw) filtered[key] = !!raw[key];
        }
        updates.toggles = filtered;
      } else {
        updates.toggles = null;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: false, error: 'No updatable fields provided' }, { status: 400 });
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('email', email)
      .select('id, email, name, business_name, business_phone, business_hours, avatar_url, google_review_url, toggles, plan, plan_status, trial_ends_at')
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, client: data });
  } catch (error) {
    console.error('[clients PATCH]', error);
    return NextResponse.json({ ok: false, error: 'Something went wrong.' }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await auth();
  if (!session || session.user?.role !== 'super_admin') {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { email, name, business_name, business_phone, plan } = await request.json();

    if (!email || !name) {
      return NextResponse.json(
        { ok: false, error: 'email and name are required' },
        { status: 400 }
      );
    }

    const VALID_PLANS = ['launch', 'rocket', 'velocity', 'starter', 'growth', 'pro'];
    const resolvedPlan = VALID_PLANS.includes(plan) ? plan : 'launch';

    const supabase = createClient();
    const { data, error } = await supabase
      .from('users')
      .insert({
        email,
        name,
        business_name: business_name || null,
        business_phone: business_phone || null,
        plan: resolvedPlan,
        role: 'client',
        active: true,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, client: data }, { status: 201 });
  } catch (error) {
    console.error('[clients POST]', error);
    return NextResponse.json({ ok: false, error: 'Something went wrong.' }, { status: 500 });
  }
}
