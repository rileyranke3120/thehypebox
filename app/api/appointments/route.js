import { auth } from '@/auth';
import { createClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

const VALID_STATUSES = ['active', 'trialing'];

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'super_admin' && !VALID_STATUSES.includes(session.user.plan_status)) {
    return NextResponse.json({ error: 'Subscription required.' }, { status: 402 });
  }

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
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'super_admin' && !VALID_STATUSES.includes(session.user.plan_status)) {
    return NextResponse.json({ error: 'Subscription required.' }, { status: 402 });
  }

  try {
    const { date, time, title, notes } = await request.json();
    if (!date || !title) {
      return NextResponse.json({ error: 'date and title are required' }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'date must be in YYYY-MM-DD format' }, { status: 400 });
    }
    if (title.length > 200) {
      return NextResponse.json({ error: 'title must be 200 characters or fewer' }, { status: 400 });
    }
    if (notes && notes.length > 2000) {
      return NextResponse.json({ error: 'notes must be 2000 characters or fewer' }, { status: 400 });
    }
    if (time && !/^\d{2}:\d{2}$/.test(time)) {
      return NextResponse.json({ error: 'time must be in HH:MM format' }, { status: 400 });
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
    return NextResponse.json({ error: 'Failed to save appointment.' }, { status: 500 });
  }
}
