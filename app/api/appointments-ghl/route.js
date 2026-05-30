import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { getAppointments } from '@/lib/ghl';
import { getGHLCredentials } from '@/lib/ghl-session';

const VALID_STATUSES = ['active', 'trialing'];

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'super_admin' && !VALID_STATUSES.includes(session.user.plan_status)) {
    return NextResponse.json({ error: 'Subscription required.' }, { status: 402 });
  }

  try {
    const { locationId, apiKey } = await getGHLCredentials(session);
    if (!locationId) return NextResponse.json({ error: 'No GHL location configured for this account.' }, { status: 400 });
    if (!apiKey) return NextResponse.json({ error: 'No GHL API key configured for this account.' }, { status: 400 });
    const past = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const future = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
    const appointments = await getAppointments(locationId, past, future, apiKey);
    return NextResponse.json({ appointments });
  } catch (err) {
    console.error('Appointments API error:', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
