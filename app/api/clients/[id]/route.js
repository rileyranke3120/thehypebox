import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function GET(_request, { params }) {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) throw error;
    if (!data) return NextResponse.json({ ok: false, error: 'Client not found' }, { status: 404 });
    return NextResponse.json({ ok: true, client: data });
  } catch (error) {
    console.error('[clients/:id GET]', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const updates = await request.json();
    const allowed = [
      'plan', 'active', 'business_name',
      'business_phone', 'business_hours', 'business_industry',
      'after_hours_handling', 'primary_goal', 'onboarding_complete',
      'retell_agent_id', 'retell_phone_number', 'toggles', 'role',
    ];
    const sanitized = Object.fromEntries(
      Object.entries(updates).filter(([k]) => allowed.includes(k))
    );

    if (Object.keys(sanitized).length === 0) {
      return NextResponse.json(
        { ok: false, error: `No valid fields to update. Allowed: ${allowed.join(', ')}` },
        { status: 400 }
      );
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from('users')
      .update(sanitized)
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, client: data });
  } catch (error) {
    console.error('[clients/:id PATCH]', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('users')
      .update({ active: false })
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, client: data });
  } catch (error) {
    console.error('[clients/:id DELETE]', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
