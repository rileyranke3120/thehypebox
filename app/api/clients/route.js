import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function GET() {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'client')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ ok: true, clients: data });
  } catch (error) {
    console.error('[clients GET]', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();

    // Allow callers to identify by email in body; fall back to session email
    const email = body.email || session.user.email;

    // Accept both short form (phone/hours — dashboard form) and canonical (business_phone/business_hours)
    const updates = {};
    if (body.business_name  !== undefined) updates.business_name  = body.business_name  || null;
    if (body.business_phone !== undefined) updates.business_phone = body.business_phone || null;
    if (body.phone          !== undefined) updates.business_phone = body.phone          || null;
    if (body.business_hours !== undefined) updates.business_hours = body.business_hours || null;
    if (body.hours          !== undefined) updates.business_hours = body.hours          || null;
    if (body.avatar_url     !== undefined) updates.avatar_url     = body.avatar_url     || null;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: false, error: 'No updatable fields provided' }, { status: 400 });
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('email', email)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, client: data });
  } catch (error) {
    console.error('[clients PATCH]', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { email, name, business_name, business_phone, plan } = await request.json();

    if (!email || !name) {
      return NextResponse.json(
        { ok: false, error: 'email and name are required' },
        { status: 400 }
      );
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from('users')
      .insert({
        email,
        name,
        business_name: business_name || null,
        business_phone: business_phone || null,
        plan: plan || 'starter',
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
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
