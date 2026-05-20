import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get('days') || '30');
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const supabase = createClient();

  const [automations, missed, reviews, reminders] = await Promise.all([
    supabase.from('automation_logs').select('*').gte('triggered_at', since).order('triggered_at', { ascending: false }).limit(200),
    supabase.from('missed_calls').select('*').gte('timestamp', since).order('timestamp', { ascending: false }).limit(200),
    supabase.from('review_requests').select('*').gte('sent_at', since).order('sent_at', { ascending: false }).limit(200),
    supabase.from('appointment_reminders').select('*').gte('sent_at', since).order('sent_at', { ascending: false }).limit(200),
  ]);

  const events = [
    ...(automations.data || []).map(r => ({ ...r, type: 'automation', ts: r.triggered_at })),
    ...(missed.data || []).filter(r => r.text_sent).map(r => ({ ...r, type: 'missed_call_text', ts: r.timestamp })),
    ...(reviews.data || []).map(r => ({ ...r, type: 'review_request', ts: r.sent_at })),
    ...(reminders.data || []).map(r => ({ ...r, type: 'appointment_reminder', ts: r.sent_at })),
  ].sort((a, b) => new Date(b.ts) - new Date(a.ts));

  return NextResponse.json({ events, total: events.length });
}
