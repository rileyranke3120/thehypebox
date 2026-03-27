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
  try {
    const { email, business_name, phone, hours } = await request.json();

    if (!email) {
      return NextResponse.json(
        { ok: false, error: 'email is required to identify the user' },
        { status: 400 }
      );
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from('users')
      .update({ business_name: business_name || null, phone: phone || null, hours: hours || null })
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
    const { email, name, business_name, phone, plan } = await request.json();

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
        phone: phone || null,
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
