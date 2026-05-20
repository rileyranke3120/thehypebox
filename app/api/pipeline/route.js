import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { getOpportunities } from '@/lib/ghl';
import { getGHLCredentials } from '@/lib/ghl-session';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { locationId, apiKey } = await getGHLCredentials(session);
    if (!locationId) return NextResponse.json({ error: 'No GHL location configured for this account.' }, { status: 400 });
    if (!apiKey) return NextResponse.json({ error: 'No GHL API key configured for this account.' }, { status: 400 });
    const opportunities = await getOpportunities(locationId, apiKey);
    return NextResponse.json({ opportunities });
  } catch (err) {
    console.error('Pipeline API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
