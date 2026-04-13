import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { getAppointments } from '@/lib/ghl';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const locationId = session.user?.ghl_location_id;
    if (!locationId) return NextResponse.json({ error: 'No GHL location configured for this account.' }, { status: 400 });
    const apiKey = session.user?.ghl_api_key || (session.user?.role === 'super_admin' ? process.env.GHL_API_KEY : null);
    if (!apiKey) return NextResponse.json({ error: 'No GHL API key configured for this account.' }, { status: 400 });
    const past = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const future = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
    const appointments = await getAppointments(locationId, past, future, apiKey);
    return NextResponse.json({ appointments });
  } catch (err) {
    console.error('Appointments API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
