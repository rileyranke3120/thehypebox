import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { getContacts } from '@/lib/ghl';
import { getGHLCredentials } from '@/lib/ghl-session';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { locationId, apiKey } = await getGHLCredentials(session);
    if (!locationId) return NextResponse.json({ error: 'No GHL location configured for this account.' }, { status: 400 });
    if (!apiKey) return NextResponse.json({ error: 'No GHL API key configured for this account.' }, { status: 400 });
    const contacts = await getContacts(locationId, apiKey);
    return NextResponse.json({ contacts });
  } catch (err) {
    console.error('Contacts API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
