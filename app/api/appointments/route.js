import { auth } from '@/auth';
import { createClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('user_email', session.user.email)
      .order('date', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ appointments: data || [] });
  } catch (err) {
    console.error('[appointments GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { date, time, title, notes } = await request.json();
    if (!date || !title) {
      return NextResponse.json({ error: 'date and title are required' }, { status: 400 });
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from('appointments')
      .insert({
        user_email: session.user.email,
        date,
        time: time || '09:00',
        title,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, appointment: data }, { status: 201 });
  } catch (err) {
    console.error('[appointments POST]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
